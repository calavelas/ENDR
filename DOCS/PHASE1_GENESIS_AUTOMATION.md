# Phase 1 - Services Check Automation (Single-PR GitOps Flow)

This phase implements the config-driven GitOps automation path without UI/API input forms.

## Goal

When `platform.yaml` or `services.yaml` changes:
1. Read desired state from config.
2. Render expected service + GitOps files from templates.
3. Compare against repository files.
4. Write a Genesis-style state file.
5. Update generated files in the same Pull Request branch before merge.

## Script

- Path: `ENDR/engine/engine.py` (subcommand: `services-check`)
- State output: `.idp/runtime/reconcile-state.yaml`

State file format (Genesis-style):

```yaml
projectName: genesis-platform
type: services-reconcile
state:
  hello-service: true
```

`true` means service files are already in sync with config/templates.
`false` means reconciliation changes are required.

## What `services-check` checks

For each service in `services.yaml`, it renders expected outputs from:
- service template (`templates.service[*]` from `platform.yaml`)
- gitops template (`templates.gitops[*]` from `platform.yaml`)

Then it compares expected content with repo files:
- `SVCS/<name>/**`
- `KUBE/clusters/gargantua/services/<name>.yaml`

If file is missing or content differs, it is marked for reconcile and included in PR changes.

Service removal handling:
- If a service exists in repo-managed paths but is removed from `services.yaml`, `ENDR/engine/engine.py services-check` marks it as removed and stages file deletions.
- Deletions include:
  - `KUBE/clusters/gargantua/services/<service>.yaml`
  - `SVCS/<service>/**`
- The generated PR will remove these files so ArgoCD prunes the app in GitOps flow.

## GitHub Actions flow

Workflows:
- `.github/workflows/reconcile-pr.yml` (PR validation)
- `.github/workflows/reconcile.yml` (post-merge reconcile)

`reconcile-pr.yml` trigger:
- `pull_request` (opened/synchronize/reopened) when changed paths include:
  - `platform.yaml`
  - `services.yaml`

`reconcile.yml` trigger:
- `push` to `main` when changed paths include `platform.yaml` / `services.yaml`
- manual `workflow_dispatch`

Behavior:
- On PR: validates the reconcile is clean for the catalog change.
- On push to `main`: runs `ENDR/engine/engine.py services-check --write-worktree`, renders expected GitOps assets, and pushes any drift back to the repo, then triggers `services-build` to publish changed service images.
- PR merge is then a single source-of-truth merge (no second reconcile PR).
- Emits GitHub job annotations and job summary with added/updated/removed service details.

## Local test

Prerequisite: backend venv available at `ENDR/.venv`.

Validate config:

```bash
make -f ENDR/scripts/Makefile validate-config
```

Dry-run reconcile (no writes, no PR):

```bash
make -f ENDR/scripts/Makefile services-check
```

Write generated files to local worktree (still no PR):

```bash
make -f ENDR/scripts/Makefile services-sync
```

Open PR manually from local machine (optional):

```bash
GITHUB_TOKEN=<your_token> ENDR/.venv/bin/python ENDR/engine/engine.py services-check --repo-root . --open-pr
```

## Portfolio framing

This phase demonstrates:
- Config-driven platform automation
- Template-based standardization (golden path)
- Drift detection + reconciliation
- GitOps-safe delivery through Pull Requests (no direct cluster writes)
