# Cluster-free Demo Deployment

A near-$0, always-on public demo of the ENDR portal **without running Kubernetes**.

## Why this works

PLEX has a config-derived mode. When `PLEX_ARGOCD_SERVER` is empty, `build_platform_snapshot()`
falls back to `_build_config_snapshot()`, which reads `SVCS.yaml` **directly from GitHub raw** and
renders the full catalog — services, image tags, templates, namespaces, gateway URLs
(`ENDR/PLEX/plex.py`). No cluster, no ArgoCD.

CASE is already proxy-correct: the browser only calls same-origin `/api/plex/*`, and the Next.js
server proxies to the backend via the **server-only** `ENDR_API_URL`
(`ENDR/CASE/src/app/lib/plex.ts`). So two small containers are the entire demo.

```
Browser ──(same-origin /api/plex/*)──▶ CASE (Next.js) ──(ENDR_API_URL, server-side)──▶ PLEX (FastAPI)
                                                                                         │ reads
                                                                          GitHub raw SVCS.yaml
```

## What you deploy

| Service | Image | Role | Key env |
|---|---|---|---|
| **PLEX** | `calavelas/plex:<tag>` | FastAPI backend, config mode | `PLEX_ARGOCD_SERVER=""`, `IDP_REPO_ROOT=/workspace` |
| **CASE** | `calavelas/case:<tag>` | Next.js portal | `ENDR_API_URL=<plex-url>` |

Pick a `<tag>` built from `main`. For the graceful "no live ArgoCD" placeholder on `/argocd`, the
**CASE** tag must be built at/after the embed-degradation change; with an older tag the embed still
targets the configured ArgoCD host and shows blank.

### Env var rules (important)
- **Do** set `ENDR_API_URL` (server-side) on CASE → the PLEX base URL.
- **Do not** set `NEXT_PUBLIC_ENDR_API_URL` — the browser never needs an absolute base (all client
  fetches are relative), and setting it can leak an unreachable/cross-origin URL.
- **Do not** set `CASE_ARGOCD_EMBED_URL` — leaving it unset renders the graceful placeholder.
- **Do not** set `GITHUB_TOKEN` on a public demo — keeps it read-only. The create page still shows a
  **dry-run preview**, but cannot open PRs without a token.

## Option A — Render (free tier), via Blueprint

A ready blueprint lives at repo root: [`render.yaml`](../render.yaml).

1. Render Dashboard → **New → Blueprint** → select this repo. It creates `endr-plex` + `endr-case`.
2. When prompted, set **`ENDR_API_URL`** on `endr-case` to the PLEX service URL after its first
   deploy (e.g. `https://endr-plex.onrender.com`).
3. Open the CASE service URL.

Notes: the blueprint overrides each image's `dockerCommand` to bind Render's injected `$PORT`
(the images otherwise hardcode 8000 / 3000). Free web services sleep when idle and cold-start on
the next request — fine for a portfolio link.

## Option B — Docker Compose (local, Fly.io, Railway, any VPS)

[`DOCS/demo/docker-compose.yml`](demo/docker-compose.yml) runs the same two containers and is the
quickest way to verify locally:

```bash
IMAGE_TAG=<tag-built-from-main> docker compose -f DOCS/demo/docker-compose.yml up
open http://localhost:3000
```

Here CASE reaches PLEX over the compose network (`ENDR_API_URL=http://plex:8000`); the browser still
only hits `localhost:3000`.

## Freshness

- **Services** (`SVCS.yaml`): config mode re-reads it from GitHub on each request, so adding a
  service through the normal PR flow appears on the demo with **no redeploy**.
- **Platform config** (`ENDR.yaml`, templates): read from the image's baked `/workspace`. Changing
  these needs a new image build (`endr-build.yml` on merge to `main`).

## Verify

- Catalog loads with the services from `SVCS.yaml`; `dataSource` is `config`.
- `/argocd` shows the "Live ArgoCD is not available in this demo" placeholder (not a blank iframe).
- Browser DevTools: requests go only to the CASE origin (`/api/plex/*`); no `localhost`/
  `svc.cluster.local` calls, no mixed-content warnings.

## Live demo (when you want the real ArgoCD)

Keep `k3d` local and only spin it up for a live walkthrough; set `PLEX_ARGOCD_SERVER` +
`CASE_ARGOCD_EMBED_URL` to switch the same images into live mode. See the tunnel fixes in the demo
plan for the local Cloudflare path.
