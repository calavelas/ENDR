# IDP Demo Documentation

## Documents
- `IDP_PYTHON_PHASE_PLAN.md`: phased implementation plan aligned to Genesis patterns.
- `PORTFOLIO_BUILD_GUIDE.md`: portfolio-focused narrative and demo checklist.
- `PHASE1_GENESIS_AUTOMATION.md`: Phase 1 config-driven reconcile automation and PR flow.
- `SETUP_GITHUB_OAUTH.md`: GitHub OAuth setup steps for local development.

## Initial Architecture
- Source of truth: GitHub monorepo
- Deployment: ArgoCD app-of-apps to local k3d
- Core Python module: `ENDR/engine/` (config, scaffold, genesis reconcile CLI, API handlers)
- Backend runtime entrypoint: FastAPI (`ENDR/api/`, thin wrapper to `engine`)
- Frontend: Next.js (`ENDR/portal/`)
- Templates: service + GitOps (`ENDR/engine/templates/`)
- Platform: ArgoCD, policies, monitoring (`KUBE/`)

## Quickstart Commands
- `make -f ENDR/scripts/Makefile bootstrap` to create local platform dependencies in k3d.
- `make -f ENDR/scripts/Makefile port-forward` to open ArgoCD and Grafana local access.
- `make -f ENDR/scripts/Makefile api` to run FastAPI backend.
- `make -f ENDR/scripts/Makefile web` to run Next.js frontend.
- `make -f ENDR/scripts/Makefile validate-config` to validate `platform.yaml` and `services.yaml`.
- `make -f ENDR/scripts/Makefile services-check` to run Phase 1 reconcile check (dry-run, no PR).
- `make -f ENDR/scripts/Makefile services-sync` to render reconcile changes into working tree.
- `make -f ENDR/scripts/Makefile smoke-test` to run automated API/config + platform smoke checks.
- `make -f ENDR/scripts/Makefile smoke-test-api` to run API/config checks only.
- `make -f ENDR/scripts/Makefile smoke-test-platform` to run bootstrap/platform checks only.

## Service Scaffolding API
- `POST /api/services` supports (canonical portal route is `POST /api/platform/services`):
  - `dryRun: true` -> render into `.idp/staging/<service>` and return generated file list.
  - `dryRun: false` -> render + create branch + commit files + open GitHub PR.

## CI/CD Notes
- Workflow `reconcile-pr.yml` runs on PR changes to `platform.yaml`/`services.yaml`, auto-tags changed service images (`git-<sha>`), executes `ENDR/engine/engine.py services-check --write-worktree`, and auto-commits generated assets back to the same PR branch.
- `reconcile-pr.yml` publishes job annotations (`::notice::`) and a Markdown job summary with changed service/file details.
- ArgoCD child app template now sets `syncOptions: [CreateNamespace=true]`.
- On merge to `main`, workflow `services-build.yml` detects changed source services, auto-sets `git-<sha>` image tags, builds images from `SVCS/<name>/Dockerfile`, pushes to Docker Hub, and persists updated tags back to repo.
- Workflow `services-build.yml` also supports manual `workflow_dispatch` to publish all services in one run.
- On PR/main changes for ENDR frontend/backend paths, workflow `platform-build.yml` builds `api` + `portal`; PRs validate build only, and `main` pushes images then updates `ENDR/api/chart/values.yaml` and `ENDR/portal/chart/values.yaml` with the new short commit SHA tag (`<sha7>`).

Optional branch cleanup toggle:
- Set repo variable `TARS_DELETE_SOURCE_BRANCH_ON_MERGE=false` to keep merged TARS branches.

Required repo secrets for Docker Hub publish:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_PASSWORD`

Image repository format for publish:
- `SVCS/<name>/chart/values.yaml` -> `image.repository` should be Docker Hub style (`docker.io/<user>/<repo>` or `<user>/<repo>`).

Prerequisites for `make -f ENDR/scripts/Makefile bootstrap`:
- `k3d`
- `kubectl`
- `helm`
