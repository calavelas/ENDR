# ENDR : Internal Developer Platform

Checkout https://endr.calavelas.net/ for Demo

GitOps Internal Developer Platform with Frontend UI Demo
- GitHub as source of truth
- ArgoCD app-of-apps deployment to local k3d
- Frontend UI to add new services and checking status
- ArgoCD UI embed within Platform Dashboard
- config-driven reconciliation (`platform.yaml` + `services.yaml`) via `ENDR/engine/engine.py services-check`

## Repository Layout

### Root config files
- `platform.yaml`: platform/project metadata, environments, and template catalog.
- `services.yaml`: application service catalog and generator inputs.

### Main folders
- `.github/`: GitHub Actions workflows for reconcile, validation, and image publishing.
- `ENDR/`: platform umbrella (the `portal`, `api`, `engine`, and `scripts` modules).
- `ENDR/portal/`: frontend developer portal (Next.js).
- `ENDR/api/`: FastAPI backend service — HTTP layer + platform/domain logic (`/api/platform`).
- `ENDR/engine/`: shared Python automation library + CLI (config loader, scaffold, reconcile).
- `ENDR/scripts/`: bootstrap/dev/CI scripts and main `Makefile`.
- `services/`: deployable application services (code + Helm chart per service).
- `KUBE/`: Kubernetes and GitOps infrastructure manifests (ArgoCD, policies, monitoring).
- `DOCS/`: architecture, setup, phase plans, and portfolio docs.
- `REFS/`: legacy/reference implementations used for migration guidance.

## Quick Start

### Documentation first
- [DOCS/README.md](DOCS/README.md)
- [DOCS/IDP_PYTHON_PHASE_PLAN.md](DOCS/IDP_PYTHON_PHASE_PLAN.md)
- [DOCS/PHASE1_GENESIS_AUTOMATION.md](DOCS/PHASE1_GENESIS_AUTOMATION.md)
- [DOCS/PORTFOLIO_BUILD_GUIDE.md](DOCS/PORTFOLIO_BUILD_GUIDE.md)

### Local dev stack (recommended)
- `make -f ENDR/scripts/Makefile dev-start`
- `make -f ENDR/scripts/Makefile dev-status`
- `make -f ENDR/scripts/Makefile dev-logs`
- `make -f ENDR/scripts/Makefile dev-stop`

Default local endpoints:
- portal frontend: `http://127.0.0.1:3000`
- api backend: `http://127.0.0.1:8000`
- api snapshot: `http://127.0.0.1:8000/api/platform`

### Common automation commands
- `make -f ENDR/scripts/Makefile bootstrap`
- `make -f ENDR/scripts/Makefile validate-config`
- `make -f ENDR/scripts/Makefile services-check`
- `make -f ENDR/scripts/Makefile services-sync`
- `make -f ENDR/scripts/Makefile smoke-test`
- `make -f ENDR/scripts/Makefile api`
- `make -f ENDR/scripts/Makefile web`

## Portal Routes

- `/`: overview dashboard with Application Services and Platform Services.
- `/services`: Application Services catalog.
- `/platform-services`: Platform Services catalog.
- `/create`: create service form (creates branch/PR updates to `services.yaml`).
- `/argocd`: embedded ArgoCD operations view.

## GitHub Automation Flow

- `reconcile-pr.yml`: reconcile check on PRs touching `platform.yaml` or `services.yaml`; optional portal auto-merge policy.
- `reconcile.yml`: reconcile/update/push on `main` when `platform.yaml` or `services.yaml` changes.
- `services-build.yml`: build/publish service images for changed service source under `services/<name>/` (excluding `chart/`), then persist image tag updates.
- `platform-build.yml`: build/publish `portal` and `api` images for platform app/runtime changes.

### Service List

<!-- TARS:SVCS_TABLE_START -->
Total Services Running: 4

| Service Name | Template |
| --- | --- |
| case | endr-robot |
| kipp | endr-robot |
| plex | endr-robot |
| tars | endr-robot |
<!-- TARS:SVCS_TABLE_END -->
