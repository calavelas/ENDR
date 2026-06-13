# Plan: Functional renaming + UI modernization

## CONFIRMED DECISIONS (2026-06-14) — executing on `main` directly

- **Dirs:** `ENDR/CASE→portal`, `ENDR/PLEX(+ENDR/TARS/api)→api`, `ENDR/TARS→engine`,
  `ENDR/SCPT→scripts`, `ENDR/BSTG→bstg`, `SVCS→services`.
- **Config files:** `ENDR.yaml→platform.yaml`, `SVCS.yaml→services.yaml` (ENDR = umbrella dir +
  project name only).
- **Domain file:** `PLEX/plex.py → api/snapshot.py` (exports `PlatformSnapshot`/`build_platform_snapshot`).
- **CLI:** `TARS/TARS.py → engine/engine.py`; subcommand `svcs-check → services-check` (keep `check` alias).
- **Backend:** entrypoint `api.main:app`; images `case→portal`, `plex→api`.
- **Workflows (purpose-based names + display names):**
  `endr-build→platform-build.yml` ("Build platform images (portal + api)"),
  `svcs-build→services-build.yml` ("Build changed service images"),
  `tars-build→reconcile.yml` ("Reconcile catalog → manifests"),
  `tars-pr→reconcile-pr.yml` ("Validate & merge service PRs"), `robot-build.yml` unchanged.
- **Portal PR identity:** branch `portal/<name>`, title `portal - Adding service : <name>`,
  body `Registered by the IDP portal.` (must match in both backend generator AND reconcile-pr.yml).
- **Bot commit prefixes (conventional, all `ci(...)`):**
  `ci(platform): persist image tag <sha> for portal/api`,
  `ci(reconcile): sync generated assets from services.yaml`,
  `ci(services): persist image tag <sha> for N service(s)`.
- **Kept as-is:** GitHub secret/variable names (CASE_PR_AUTHOR, CASE_AUTOMERGE_TOKEN,
  TARS_DELETE_SOURCE_BRANCH_ON_MERGE) — external repo settings, invisible to app viewers; renaming
  silently breaks them. `IDPConfig` model name (IDP is generic, not a codename).
- De-cosmic vocabulary (Part 2) already merged. UI redesign (Part 3) follows after this lands.



## Context

ENDR's naming is muddled on two levels:

1. **Module codenames are opaque and overloaded.** `CASE` / `PLEX` / `TARS` are Interstellar
   codenames a reviewer can't decode. Worse, the **backend has three names**: it's run as
   `TARS.api.main:app`, the README calls it the **"ENDR backend"**, and its Docker image is named
   **`plex`**. So `ENDR` (which should be *only* the platform name) leaks into meaning "the backend."
2. **The data layer uses cosmic metaphors** — `PlexUniverse`, `galaxyName`, `coreApps`,
   `orbitBand` — which read as gimmicky and are out of step with the UI's plain labels.

Goal: rename modules to **functional** names, fix the ENDR-as-backend leak, de-cosmic the data
vocabulary, and modernize the UI to a clean, non-themed dashboard.

## Target structure (the decision to confirm)

```
ENDR/                       platform umbrella  ← NAME UNCHANGED (platform only, never "backend")
  portal/    ← CASE         Next.js frontend                      image: portal  (was case)
  api/       ← PLEX + TARS/api   FastAPI backend service          image: api     (was plex)
  engine/    ← TARS (minus api)  automation library + CLI         (config, scaffold, cli, templates)
  scripts/   ← SCPT         bootstrap/dev scripts + Makefile
  bstg/      ← BSTG         Backstage track (optional rename)
services/    ← SVCS         deployable application services (top-level)
```

- Backend entrypoint: `TARS.api.main:app` → **`api.main:app`**.
- **Key decision:** move the FastAPI HTTP layer (`TARS/api/*`) **into the new `api/` module**, so
  `api` = the whole backend service (HTTP + the portal-data/domain logic that was PLEX), and
  `engine` = a pure automation library (config, scaffold, cli, templates) with no HTTP. This avoids
  an `api`-vs-`engine/api` name collision. **(Recommended — confirm before I execute.)**
- CLI: `ENDR/TARS/TARS.py` → `ENDR/engine/engine.py`.
- "ENDR backend" → **"api service"** everywhere in docs/labels.

---

## Part 1 — Module / structure rename (the big one; live-cluster migration)

Mechanical but wide. Must land as one coordinated change because the **live GitOps cluster**
references these paths and image names.

### What changes
- **Directories:** `ENDR/CASE`→`ENDR/portal`, `ENDR/PLEX`(+`ENDR/TARS/api`)→`ENDR/api`,
  `ENDR/TARS`→`ENDR/engine`, `ENDR/SCPT`→`ENDR/scripts`, `SVCS`→`services`.
- **Python imports:** `from TARS.x`→`from engine.x`, `from PLEX.x`→`from api.x`; the `sys.path`
  bootstrap in the CLI; `--app-dir ENDR` stays (ENDR is still the package root).
- **Docker images:** `calavelas/case`→`calavelas/portal`, `calavelas/plex`→`calavelas/api`;
  Dockerfiles move with their dirs; backend CMD → `uvicorn api.main:app`.
- **Helm charts:** `ENDR/CASE/chart`→`ENDR/portal/chart`, `ENDR/PLEX/chart`→`ENDR/api/chart`;
  `image.repository` in each `values.yaml`.
- **ArgoCD apps:** `KUBE/clusters/mac/lab/platform/case.yaml`→`portal.yaml` (path `ENDR/portal/chart`),
  `plex.yaml`→`api.yaml` (path `ENDR/api/chart`). On sync, ArgoCD prunes the old `case`/`plex` apps
  and creates `portal`/`api`.
- **CI** (`.github/workflows/endr-build.yml`): path filters (`ENDR/CASE/**`→`ENDR/portal/**`, etc.),
  build contexts/dockerfiles, the image map, and the chart-values bump targets.
- **TARS service-discovery** (`ENDR/TARS/TARS.py`/`engine`) and `svcs-build.yml` reference the `SVCS/`
  prefix → `services/`; `service_name_from_path` and related must follow.
- **Config:** `ENDR.yaml` template paths `ENDR/TARS/templates/*`→`ENDR/engine/templates/*`.
- **Docs/Makefile/READMEs:** all `TARS.api.main`, "ENDR backend", `make` targets, paths.

### Cluster migration order (so the demo doesn't break)
1. Do the rename on a branch; keep `ENDR.yaml`/`SVCS.yaml`→`services` consistent.
2. Merge to `main` → CI builds **new** `portal` + `api` images and bumps the renamed charts.
3. ArgoCD syncs the renamed apps: new `portal`/`api` apps come up, old `case`/`plex` are pruned.
   Namespaces (`endr`, `demo`) unchanged. Verify pods + the tunnel hosts still serve.
4. The `plex-github-token` secret (ns `endr`) is unaffected (same namespace).

### Risk
High blast radius on a live cluster. Mitigation: one atomic PR, verify CI builds both new images
before merge, watch the ArgoCD prune/create, keep a rollback (revert the PR → old images/charts).

---

## Part 2 — Data vocabulary (de-cosmic)

Within the new `api/` + `portal/` modules. The wire contract (`galaxyName`/`coreApps`/`orbitBand`)
changes, so `api` and `portal` ship together.

| Cosmic | Plain |
|---|---|
| `PlexUniverse` / `PlexUniverseSnapshot` | `PlatformSnapshot` |
| `PlexNode` | `ServiceNode` |
| `galaxyName` | `clusterName` |
| `coreApps` | `platformServices` |
| `orbitBand` | **delete** (dead code — never rendered) |
| `build_plex_universe` / `_build_config_universe` | `build_platform_snapshot` / `_build_config_snapshot` |
| `loadUniverse` / `buildFallbackUniverse` | `loadSnapshot` / `buildFallbackSnapshot` |
| `findCoreAppByName` / `hasServiceInUniverse` | `findPlatformServiceByName` / `hasService` |
| var `universe` | `snapshot` |

Keep `services` (application services — not cosmic), `dataSource`, `clusterPath`, `servicesPath`,
status fields. Audit user-facing copy for any "universe"/"galaxy" strings too.

---

## Part 3 — UI modernization (clean, not themed)

Direction: clean professional dashboard (Linear/Vercel/modern-Backstage); **no** orbital/space
motif. Tokenized design system (palette, type scale, spacing) in `globals.css`; stat-card overview;
catalog with search/filter/sort + better density + real empty/loading states; tightened create flow;
shared `StatusPill`/`StatCard`/`Toolbar` components.

---

## Sequencing
1. **Part 1 (module rename)** — its own PR; the live-cluster migration. Confirm the target tree first.
2. **Part 2 (vocabulary)** — within the renamed modules.
3. **Part 3 (UI)** — on the clean base.

Each is an independent PR, deployed via GitOps. Parts 1+2 both touch the api/portal data files, so
they could be combined into one "naming overhaul" PR if you'd prefer fewer, bigger PRs.

## Verification
Per PR: `tsc --noEmit` (portal), a backend import/serialize smoke check, the cluster-free
`docker-compose` demo loads the catalog (contract in sync), `grep` for leftover old names, and the
ArgoCD prune/create + tunnel hosts verified after the module-rename deploy.
