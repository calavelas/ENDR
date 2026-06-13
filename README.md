# ENDR : Internal Developer Platform

Checkout https://endr.calavelas.net/ for Demo

GitOps Internal Developer Platform with Frontend UI Demo
- GitHub as source of truth
- ArgoCD app-of-apps deployment to local k3d
- Frontend UI to add new services and checking status
- ArgoCD UI embed within Platform Dashboard
- config-driven reconciliation (`ENDR.yaml` + `SVCS.yaml`) via `ENDR/engine/engine.py svcs-check`

## Repository Layout

### Root config files
- `ENDR.yaml`: platform/project metadata, environments, and template catalog.
- `SVCS.yaml`: application service catalog and generator inputs.

### Main folders
- `.github/`: GitHub Actions workflows for reconcile, validation, and image publishing.
- `ENDR/`: platform umbrella (backend runtime plus CASE, PLEX, SCPT, TARS).
- `ENDR/CASE/`: frontend developer portal (Next.js).
- `ENDR/BSTG/`: Backstage alternative track (templates + custom scaffolder actions).
- `DOCS/`: architecture, setup, phase plans, and portfolio docs.
- `ENDR/PLEX/`: backend portal domain module (`/api/plex`).
- `KUBE/`: Kubernetes and GitOps infrastructure manifests (ArgoCD, policies, monitoring).
- `REFS/`: legacy/reference implementations used for migration guidance.
- `ENDR/scripts/`: bootstrap/dev/CI scripts and main `Makefile`.
- `SVCS/`: deployable application services (code + Helm chart per service).
- `ENDR/engine/`: shared Python automation engine (config loader, scaffold logic, reconcile CLI/API).

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
- CASE frontend: `http://127.0.0.1:3000`
- ENDR backend: `http://127.0.0.1:8000`
- PLEX API: `http://127.0.0.1:8000/api/plex`

### Common automation commands
- `make -f ENDR/scripts/Makefile bootstrap`
- `make -f ENDR/scripts/Makefile validate-config`
- `make -f ENDR/scripts/Makefile svcs-check`
- `make -f ENDR/scripts/Makefile svcs-sync`
- `make -f ENDR/scripts/Makefile smoke-test`
- `make -f ENDR/scripts/Makefile api`
- `make -f ENDR/scripts/Makefile web`

## CASE Portal Routes

- `/`: overview dashboard with Application Services and Platform Services.
- `/services`: Application Services catalog.
- `/platform-services`: Platform Services catalog.
- `/create`: create service form (creates branch/PR updates to `SVCS.yaml`).
- `/argocd`: embedded ArgoCD operations view.

## GitHub Automation Flow

- `tars-pr.yml`: reconcile check on PRs touching `ENDR.yaml` or `SVCS.yaml`; optional CASE auto-merge policy.
- `tars-build.yml`: reconcile/update/push on `main` when `ENDR.yaml` or `SVCS.yaml` changes.
- `svcs-build.yml`: build/publish service images for changed service source under `SVCS/<name>/` (excluding `chart/`), then persist image tag updates.
- `endr-build.yml`: build/publish `case` and `plex` images for ENDR app/runtime changes.

### SVCS (Service) List

<!-- TARS:SVCS_TABLE_START -->
Total Services Running: 5

| Service Name | Template |
| --- | --- |
| cooper | python-fastapi |
| finc | python-fastapi |
| miller | python-fastapi |
| sample | python-fastapi |
| test1 | python-fastapi |
<!-- TARS:SVCS_TABLE_END -->
