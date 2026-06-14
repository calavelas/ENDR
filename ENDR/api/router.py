import os
import re
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pathlib import Path

from engine.scaffold.github_client import GitHubAPIError, GitHubClient
from engine.scaffold.service import (
    CreateServiceRequest,
    CreateServiceResponse,
    create_service,
    remove_service_entry_bytes,
)
from api.snapshot import (
    PlatformSnapshot,
    ServiceArgoDetail,
    build_platform_snapshot,
    build_service_argocd_detail,
    load_platform_configs,
)
from api.transactions import (
    CaseHistoryResponse,
    TransactionStatusResponse,
    get_case_history,
    get_case_transaction_status,
    record_case_submission,
)

router = APIRouter()


class CreateTemplateOption(BaseModel):
    name: str
    description: str = ""
    path: str = ""
    previewFiles: list[str] = Field(default_factory=list)
    previewNote: str = ""


class CreateOptionsResponse(BaseModel):
    serviceTemplates: list[CreateTemplateOption]
    gitopsTemplates: list[CreateTemplateOption]
    namespaces: list[CreateTemplateOption]
    kubernetesEnvironments: list[CreateTemplateOption]
    existingServices: list[str]


class CreateServiceFromPortalRequest(BaseModel):
    serviceName: str = Field(min_length=1, max_length=48)
    namespace: str = Field(min_length=1)
    environment: str = Field(min_length=1)
    serviceTemplate: str = Field(min_length=1)
    gitopsTemplate: str = Field(min_length=1)
    gatewayEnabled: bool = True
    image: str | None = None
    env: dict[str, str] = Field(default_factory=dict)
    branchName: str | None = None
    dryRun: bool = False


class TemplateFileResponse(BaseModel):
    templateType: str
    templateName: str
    filePath: str
    size: int
    content: str
    contentEncoding: str = "utf-8"
    truncated: bool = False


_TEMPLATE_FILE_PREVIEW_MAX_BYTES = 128 * 1024


def _build_template_preview(repo_root: Path, template_path: str, limit: int = 12) -> tuple[list[str], str]:
    path = template_path.strip()
    if not path:
        return [], "template path is empty"

    if path.startswith(("http://", "https://", "git@", "ssh://")) or path.endswith(".git"):
        return [], "remote template preview is unavailable"

    resolved = (repo_root / path).resolve()
    if not resolved.exists():
        return [], "template path not found in repository"

    files_root = resolved / "files"
    if not files_root.exists():
        return [], "template files/ directory is missing"

    preview_files = [
        candidate.relative_to(files_root).as_posix()
        for candidate in sorted(files_root.rglob("*"))
        if candidate.is_file()
    ]
    if not preview_files:
        return [], "template has no files"

    if len(preview_files) > limit:
        return preview_files[:limit], f"showing first {limit} of {len(preview_files)} files"
    return preview_files, ""


def _build_template_option(template: object, repo_root: Path) -> CreateTemplateOption:
    name = str(getattr(template, "name", "")).strip()
    description = str(getattr(template, "description", "")).strip()
    path = str(getattr(template, "path", "")).strip()
    preview_files, preview_note = _build_template_preview(repo_root, path)
    return CreateTemplateOption(
        name=name,
        description=description,
        path=path,
        previewFiles=preview_files,
        previewNote=preview_note,
    )


def _resolve_local_template_root(repo_root: Path, template_path: str) -> Path:
    path = template_path.strip()
    if not path:
        raise ValueError("template path is empty")

    if path.startswith(("http://", "https://", "git@", "ssh://")) or path.endswith(".git"):
        raise ValueError("remote templates are not supported for file preview")

    resolved = (repo_root / path).resolve()
    if not resolved.exists():
        raise ValueError("template path not found in repository")

    files_root = (resolved / "files").resolve()
    if not files_root.exists() or not files_root.is_dir():
        raise ValueError("template files/ directory is missing")

    return files_root


def _read_template_file(files_root: Path, file_path: str) -> tuple[int, str, bool]:
    normalized = file_path.strip().lstrip("/")
    if not normalized:
        raise ValueError("filePath is required")

    target = (files_root / normalized).resolve()
    try:
        target.relative_to(files_root)
    except ValueError as exc:
        raise ValueError("filePath escapes template files root") from exc

    if not target.exists() or not target.is_file():
        raise ValueError("template file not found")

    raw = target.read_bytes()
    preview = raw[:_TEMPLATE_FILE_PREVIEW_MAX_BYTES]
    text = preview.decode("utf-8", errors="replace")
    truncated = len(raw) > _TEMPLATE_FILE_PREVIEW_MAX_BYTES
    return len(raw), text, truncated


@router.get("/api/platform", response_model=PlatformSnapshot)
def get_platform_snapshot() -> PlatformSnapshot:
    try:
        return build_platform_snapshot()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"unable to build platform snapshot: {exc}") from exc


@router.get("/api/platform/templates", response_model=CreateOptionsResponse)
def get_create_options() -> CreateOptionsResponse:
    try:
        idp_config, services_config, _paths, _svcs_url = load_platform_configs()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"unable to load platform create options: {exc}") from exc

    repo_root = Path(_paths.repoRoot).resolve()
    service_templates = [_build_template_option(template, repo_root) for template in idp_config.templates.service]
    gitops_templates = [_build_template_option(template, repo_root) for template in idp_config.templates.gitops]
    namespace_options = [
        CreateTemplateOption(name=namespace.name, description=namespace.description)
        for namespace in idp_config.config.namespace
    ]
    environment_options = [
        CreateTemplateOption(name=environment.name, description=environment.description)
        for environment in idp_config.config.environments.kubernetes
    ]
    if not namespace_options:
        namespace_options = [CreateTemplateOption(name="default", description="Default namespace")]
    if not environment_options:
        environment_options = [
            CreateTemplateOption(name=alias, description="")
            for alias in sorted(idp_config.config.clusters.keys())
        ]
    existing_services = sorted(service.name for service in services_config.services)

    return CreateOptionsResponse(
        serviceTemplates=service_templates,
        gitopsTemplates=gitops_templates,
        namespaces=namespace_options,
        kubernetesEnvironments=environment_options,
        existingServices=existing_services,
    )


@router.get("/api/platform/template-file", response_model=TemplateFileResponse)
def get_template_file(templateType: str, templateName: str, filePath: str) -> TemplateFileResponse:
    requested_type = templateType.strip().lower()
    requested_name = templateName.strip()
    requested_path = filePath.strip()
    if requested_type not in {"service", "gitops"}:
        raise HTTPException(status_code=400, detail="templateType must be one of: service, gitops")
    if not requested_name:
        raise HTTPException(status_code=400, detail="templateName is required")
    if not requested_path:
        raise HTTPException(status_code=400, detail="filePath is required")

    try:
        idp_config, _services_config, paths, _svcs_url = load_platform_configs()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"unable to load template file options: {exc}") from exc

    catalog = idp_config.templates.service if requested_type == "service" else idp_config.templates.gitops
    template_path = ""
    for template in catalog:
        name = str(getattr(template, "name", "")).strip()
        if name == requested_name:
            template_path = str(getattr(template, "path", "")).strip()
            break
    if not template_path:
        raise HTTPException(status_code=404, detail=f"template not found: {requested_name}")

    repo_root = Path(paths.repoRoot).resolve()
    try:
        files_root = _resolve_local_template_root(repo_root, template_path)
        size, content, truncated = _read_template_file(files_root, requested_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"unable to read template file: {exc}") from exc

    return TemplateFileResponse(
        templateType=requested_type,
        templateName=requested_name,
        filePath=requested_path,
        size=size,
        content=content,
        contentEncoding="utf-8",
        truncated=truncated,
    )


_ENV_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _sanitize_env(env: dict[str, str]) -> dict[str, str]:
    """Only env is user-configurable. Keep it a flat map of safe keys -> string
    values (defends against malformed/injected payloads bypassing the UI)."""
    clean: dict[str, str] = {}
    for key, value in (env or {}).items():
        name = str(key).strip()
        if not name:
            continue
        if not _ENV_KEY_RE.match(name):
            raise HTTPException(status_code=400, detail=f"invalid env variable name: {name!r}")
        if isinstance(value, (dict, list)):
            raise HTTPException(status_code=400, detail=f"env value for {name!r} must be a scalar")
        clean[name] = str(value)
    return clean


@router.post("/api/platform/services", response_model=CreateServiceResponse)
def create_service_from_portal(payload: CreateServiceFromPortalRequest) -> CreateServiceResponse:
    # Image is platform-controlled — the only developer-configurable override is env.
    if payload.image and payload.image.strip():
        raise HTTPException(
            status_code=400,
            detail="image is platform-controlled and cannot be set from the portal; only environment variables are configurable",
        )
    env = _sanitize_env(payload.env)
    request = CreateServiceRequest(
        name=payload.serviceName.strip(),
        namespace=payload.namespace.strip(),
        environments=[payload.environment.strip()],
        serviceTemplate=payload.serviceTemplate.strip(),
        gitopsTemplate=payload.gitopsTemplate.strip(),
        gatewayEnabled=payload.gatewayEnabled,
        image=None,
        env=env,
        dryRun=payload.dryRun,
        branchName=payload.branchName.strip() if payload.branchName and payload.branchName.strip() else None,
    )
    try:
        response = create_service(request)
        if (
            not payload.dryRun
            and response.pullRequestNumber
            and response.pullRequestNumber > 0
            and response.pullRequestUrl
        ):
            # Persistence should not block service creation if state store is unavailable.
            try:
                record_case_submission(
                    service_name=response.serviceName,
                    pull_request_number=response.pullRequestNumber,
                    pull_request_url=response.pullRequestUrl,
                    branch_name=response.branchName,
                )
            except Exception:  # noqa: BLE001
                pass
        return response
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/platform/services/{name}/argocd", response_model=ServiceArgoDetail)
def get_service_argocd_detail(name: str) -> ServiceArgoDetail:
    try:
        return build_service_argocd_detail(name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"unable to load ArgoCD detail: {exc}") from exc


# ── Service files (GitOps source) — browse + edit-via-PR (Phase D) ────────────
class ServiceFileNode(BaseModel):
    path: str
    relativePath: str
    size: int
    editable: bool


class ServiceFilesResponse(BaseModel):
    serviceName: str
    basePath: str
    branch: str
    available: bool
    files: list[ServiceFileNode]
    warnings: list[str] = Field(default_factory=list)


class ServiceFileContentResponse(BaseModel):
    serviceName: str
    path: str
    size: int
    content: str
    editable: bool
    truncated: bool = False


class EditServiceFileRequest(BaseModel):
    path: str = Field(min_length=1)
    content: str
    branchName: str | None = None
    dryRun: bool = False


class EditServiceFileResponse(BaseModel):
    serviceName: str
    path: str
    dryRun: bool
    branchName: str | None = None
    pullRequestUrl: str | None = None
    pullRequestNumber: int | None = None


_SERVICE_FILE_PREVIEW_MAX_BYTES = 128 * 1024


def _service_base_path(name: str) -> str:
    return f"SVCS/{name.strip()}"


def _is_editable_service_path(base: str, path: str) -> bool:
    # Developers tune chart values; templates are platform-owned (read-only).
    return path == f"{base}/chart/values.yaml"


def _resolve_app_service(name: str) -> tuple[object, str, str]:
    """Validate the name is an application service; return (idp_config, base, branch)."""
    idp_config, services_config, _paths, _svcs_url = load_platform_configs()
    known = {service.name for service in services_config.services}
    if name.strip() not in known:
        raise HTTPException(status_code=404, detail=f"unknown application service: {name}")
    return idp_config, _service_base_path(name), idp_config.config.git.defaultBranch


def _github_client(idp_config: object) -> GitHubClient:
    # Tokenless is fine for reads on the public repo; the edit path requires a token.
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    git = idp_config.config.git  # type: ignore[attr-defined]
    return GitHubClient(token=token, owner=git.owner, repo=git.repo)


def _assert_values_only_env_changed(client: GitHubClient, branch: str, path: str, proposed_text: str) -> None:
    """Enforce that an edit to a chart values.yaml changes ONLY the env block. All
    platform-owned fields (image, service, resources, httpRoute, …) are locked —
    defends against a crafted payload bypassing the read-only UI."""
    try:
        import yaml
    except ModuleNotFoundError:
        return

    try:
        proposed = yaml.safe_load(proposed_text)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"invalid YAML: {exc}") from exc
    if not isinstance(proposed, dict):
        raise HTTPException(status_code=400, detail="values.yaml must be a YAML mapping")

    env = proposed.get("env")
    if env is not None:
        if not isinstance(env, dict):
            raise HTTPException(status_code=400, detail="env must be a mapping of variable -> value")
        for key, value in env.items():
            if not isinstance(key, str) or not _ENV_KEY_RE.match(key):
                raise HTTPException(status_code=400, detail=f"invalid env variable name: {key!r}")
            if isinstance(value, (dict, list)):
                raise HTTPException(status_code=400, detail=f"env value for {key!r} must be a scalar")

    current_raw = client.get_file_content(branch, path)
    if current_raw is None:
        raise HTTPException(status_code=400, detail="cannot validate edit: current values.yaml not found")
    current = yaml.safe_load(current_raw.decode("utf-8")) or {}
    if not isinstance(current, dict):
        raise HTTPException(status_code=400, detail="current values.yaml is malformed")

    current_locked = {key: value for key, value in current.items() if key != "env"}
    proposed_locked = {key: value for key, value in proposed.items() if key != "env"}
    if proposed_locked != current_locked:
        changed = sorted(
            key for key in set(current_locked) | set(proposed_locked) if current_locked.get(key) != proposed_locked.get(key)
        )
        raise HTTPException(
            status_code=400,
            detail=f"only the 'env' block is editable; these platform-owned fields cannot change: {', '.join(changed) or 'structure'}",
        )


@router.get("/api/platform/services/{name}/files", response_model=ServiceFilesResponse)
def get_service_files(name: str) -> ServiceFilesResponse:
    idp_config, base, branch = _resolve_app_service(name)
    client = _github_client(idp_config)
    try:
        blobs = client.list_tree(branch, base)
    except GitHubAPIError as exc:
        return ServiceFilesResponse(
            serviceName=name,
            basePath=base,
            branch=branch,
            available=False,
            files=[],
            warnings=[f"unable to list files: {exc}"],
        )

    files = [
        ServiceFileNode(
            path=blob["path"],
            relativePath=blob["path"][len(base) + 1 :] if blob["path"].startswith(base + "/") else blob["path"],
            size=int(blob.get("size") or 0),
            editable=_is_editable_service_path(base, blob["path"]),
        )
        for blob in sorted(blobs, key=lambda item: item["path"])
    ]
    return ServiceFilesResponse(serviceName=name, basePath=base, branch=branch, available=True, files=files)


@router.get("/api/platform/services/{name}/file", response_model=ServiceFileContentResponse)
def get_service_file(name: str, path: str) -> ServiceFileContentResponse:
    idp_config, base, branch = _resolve_app_service(name)
    normalized = path.strip().lstrip("/")
    if not (normalized == base or normalized.startswith(base + "/")):
        raise HTTPException(status_code=400, detail="path is outside the service folder")
    client = _github_client(idp_config)
    try:
        raw = client.get_file_content(branch, normalized)
    except GitHubAPIError as exc:
        raise HTTPException(status_code=502, detail=f"unable to read file: {exc}") from exc
    if raw is None:
        raise HTTPException(status_code=404, detail="file not found")

    preview = raw[:_SERVICE_FILE_PREVIEW_MAX_BYTES]
    return ServiceFileContentResponse(
        serviceName=name,
        path=normalized,
        size=len(raw),
        content=preview.decode("utf-8", errors="replace"),
        editable=_is_editable_service_path(base, normalized),
        truncated=len(raw) > _SERVICE_FILE_PREVIEW_MAX_BYTES,
    )


@router.post("/api/platform/services/{name}/file", response_model=EditServiceFileResponse)
def edit_service_file(name: str, payload: EditServiceFileRequest) -> EditServiceFileResponse:
    idp_config, base, branch = _resolve_app_service(name)
    normalized = payload.path.strip().lstrip("/")
    if not _is_editable_service_path(base, normalized):
        raise HTTPException(status_code=400, detail="only the chart values.yaml is editable from the portal")

    # Core assistants (TARS/CASE, ENDR_ALLOW_SELF_DESTRUCT=false) are read-only.
    if _decommission_eligibility(name).protected:
        raise HTTPException(status_code=403, detail="this is a protected core unit; its config is read-only from the portal")

    client = _github_client(idp_config)
    _assert_values_only_env_changed(client, branch, normalized, payload.content)

    if payload.dryRun:
        return EditServiceFileResponse(serviceName=name, path=normalized, dryRun=True)

    if not os.environ.get("GITHUB_TOKEN", "").strip():
        raise HTTPException(status_code=400, detail="GITHUB_TOKEN is required to open a pull request")

    timestamp = datetime.now(tz=UTC).strftime("%Y%m%d%H%M%S")
    branch_name = (payload.branchName.strip() if payload.branchName and payload.branchName.strip() else None) or f"portal/{name}-edit-{timestamp}"
    base_branch = branch
    try:
        base_sha = client.get_ref_sha(base_branch)
        client.create_branch(branch_name, base_sha)
        client.create_or_update_file(
            branch=branch_name,
            file_path=normalized,
            content_bytes=payload.content.encode("utf-8"),
            commit_message=f"fix(portal): update {name} chart values",
        )
        pr = client.create_pull_request(
            title=f"portal - update config : {name}",
            body=(
                f"Edited from the ENDR portal.\n\n"
                f"- service: `{name}`\n"
                f"- file: `{normalized}`\n"
                f"- merge to roll out via ArgoCD"
            ),
            head=branch_name,
            base=base_branch,
        )
    except GitHubAPIError as exc:
        raise HTTPException(status_code=400, detail=f"github api failure during edit PR: {exc}") from exc

    try:
        record_case_submission(
            service_name=name,
            pull_request_number=pr.number,
            pull_request_url=pr.html_url,
            branch_name=branch_name,
        )
    except Exception:  # noqa: BLE001
        pass

    return EditServiceFileResponse(
        serviceName=name,
        path=normalized,
        dryRun=False,
        branchName=branch_name,
        pullRequestUrl=pr.html_url,
        pullRequestNumber=pr.number,
    )


# ── Decommission (Phase E destroy) — remove a portal-created service via PR ────
_PROTECT_ENV_KEY = "ENDR_ALLOW_SELF_DESTRUCT"


class DecommissionEligibility(BaseModel):
    serviceName: str
    decommissionable: bool
    protected: bool
    reason: str = ""


class DecommissionServiceRequest(BaseModel):
    dryRun: bool = False


class DecommissionServiceResponse(BaseModel):
    serviceName: str
    dryRun: bool
    branchName: str | None = None
    pullRequestUrl: str | None = None
    pullRequestNumber: int | None = None


def _find_service_entry(name: str) -> object | None:
    _idp, services_config, _paths, _svcs_url = load_platform_configs()
    target = name.strip()
    for service in services_config.services:
        if service.name == target:
            return service
    return None


def _service_is_protected(entry: object) -> bool:
    env = getattr(getattr(entry, "overrides", None), "env", None) or {}
    return str(env.get(_PROTECT_ENV_KEY, "")).strip().lower() in ("false", "0", "no", "off")


def _entry_status_in_raw(raw: bytes, name: str) -> tuple[bool, bool]:
    """Return (exists, protected) for `name` in the given services.yaml bytes.
    Used to re-validate against the exact content being modified (closes the TOCTOU
    window between the eligibility check and the GitHub fetch)."""
    import yaml

    data = yaml.safe_load(raw.decode("utf-8")) or {}
    services = data.get("services", []) if isinstance(data, dict) else []
    if not isinstance(services, list):
        return False, False
    for service in services:
        if not isinstance(service, dict) or service.get("name") != name:
            continue
        overrides = service.get("overrides")
        env = overrides.get("env") if isinstance(overrides, dict) else None
        env = env if isinstance(env, dict) else {}
        protected = str(env.get(_PROTECT_ENV_KEY, "")).strip().lower() in ("false", "0", "no", "off")
        return True, protected
    return False, False


def _decommission_eligibility(name: str) -> DecommissionEligibility:
    target = name.strip()
    # Prefer the FRESH services.yaml from GitHub — the API's baked IDP_REPO_ROOT copy
    # can be stale for services created after the image was built, which would make
    # them wrongly 403 (the kipp/plex case). Fall back to the local snapshot.
    exists: bool | None = None
    protected = False
    try:
        idp_config, _services_config, _paths, _svcs_url = load_platform_configs()
        client = _github_client(idp_config)
        raw = client.get_file_content(idp_config.config.git.defaultBranch, "services.yaml")
        if raw is not None:
            exists, protected = _entry_status_in_raw(raw, target)
    except Exception:  # noqa: BLE001
        exists = None
    if exists is None:
        entry = _find_service_entry(target)
        exists = entry is not None
        protected = bool(entry is not None and _service_is_protected(entry))

    if not exists:
        # Platform/core services are not in services.yaml and cannot be removed here.
        return DecommissionEligibility(
            serviceName=name, decommissionable=False, protected=False,
            reason="not a portal-managed service",
        )
    if protected:
        return DecommissionEligibility(
            serviceName=name, decommissionable=False, protected=True,
            reason="protected core unit (self-destruct disabled)",
        )
    return DecommissionEligibility(serviceName=name, decommissionable=True, protected=False)


@router.get("/api/platform/services/{name}/decommission", response_model=DecommissionEligibility)
def get_decommission_eligibility(name: str) -> DecommissionEligibility:
    return _decommission_eligibility(name)


@router.post("/api/platform/services/{name}/decommission", response_model=DecommissionServiceResponse)
def decommission_service(name: str, payload: DecommissionServiceRequest) -> DecommissionServiceResponse:
    # Server-side enforcement (defends against a crafted request bypassing the UI):
    # only portal-managed, non-protected services can be removed.
    eligibility = _decommission_eligibility(name)
    if not eligibility.decommissionable:
        raise HTTPException(status_code=403, detail=f"cannot decommission '{name}': {eligibility.reason}")

    if payload.dryRun:
        return DecommissionServiceResponse(serviceName=name, dryRun=True)

    if not os.environ.get("GITHUB_TOKEN", "").strip():
        raise HTTPException(status_code=400, detail="GITHUB_TOKEN is required to open a pull request")

    idp_config, _services_config, _paths, _svcs_url = load_platform_configs()
    client = _github_client(idp_config)
    base_branch = idp_config.config.git.defaultBranch

    current = client.get_file_content(base_branch, "services.yaml")
    if current is None:
        raise HTTPException(status_code=400, detail="services.yaml not found on the default branch")

    # Re-validate against the exact content we're about to modify — the eligibility
    # check above used a possibly-stale local snapshot. This closes the TOCTOU window
    # where a service could become protected between the two reads.
    exists, protected = _entry_status_in_raw(current, name.strip())
    if not exists:
        raise HTTPException(status_code=404, detail=f"service not found in services.yaml: {name}")
    if protected:
        raise HTTPException(status_code=403, detail=f"cannot decommission '{name}': protected core unit")

    try:
        updated = remove_service_entry_bytes(current, name.strip())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    timestamp = datetime.now(tz=UTC).strftime("%Y%m%d%H%M%S")
    branch_name = f"portal/{name}-decommission-{timestamp}"
    try:
        base_sha = client.get_ref_sha(base_branch)
        client.create_branch(branch_name, base_sha)
        client.create_or_update_file(
            branch=branch_name,
            file_path="services.yaml",
            content_bytes=updated,
            commit_message=f"feat(idp): decommission service {name}",
        )
        pr = client.create_pull_request(
            title=f"portal - Decommission service : {name}",
            body=(
                "Decommissioned from the ENDR portal.\n\n"
                f"- service: `{name}`\n"
                "- changed files in PR: `services.yaml` only\n"
                "- on merge, reconcile prunes the chart + ArgoCD app and ArgoCD removes the workload"
            ),
            head=branch_name,
            base=base_branch,
        )
    except GitHubAPIError as exc:
        raise HTTPException(status_code=400, detail=f"github api failure during decommission PR: {exc}") from exc

    try:
        record_case_submission(
            service_name=name,
            pull_request_number=pr.number,
            pull_request_url=pr.html_url,
            branch_name=branch_name,
        )
    except Exception:  # noqa: BLE001
        pass

    return DecommissionServiceResponse(
        serviceName=name,
        dryRun=False,
        branchName=branch_name,
        pullRequestUrl=pr.html_url,
        pullRequestNumber=pr.number,
    )


@router.get("/api/platform/history", response_model=CaseHistoryResponse)
def get_case_history_from_portal(
    limit: int = 50,
    service: str = "",
    author: str = "",
    prState: str = "all",
    pipelineStatus: str = "all",
) -> CaseHistoryResponse:
    try:
        return get_case_history(
            limit=limit,
            service_filter=service,
            author_filter=author,
            pr_state=prState,
            pipeline_status=pipelineStatus,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"unable to load service history: {exc}") from exc


@router.get("/api/platform/transactions/{pullRequestNumber}", response_model=TransactionStatusResponse)
def get_case_transaction_from_portal(pullRequestNumber: int) -> TransactionStatusResponse:
    try:
        return get_case_transaction_status(pullRequestNumber)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"unable to resolve transaction status: {exc}") from exc
