# Lab Platform Apps

Platform ArgoCD child `Application` manifests for `mac/lab` live here.

Current usage:
- `argocd.yaml`: ArgoCD self-management app.
- `traefik.yaml`: Traefik platform app.
- `cloudflare-gateway.yaml`: Cloudflare Gateway API controller app (from upstream `pl4nty/cloudflare-kubernetes-gateway`).
- `plex.yaml`: PLEX backend API app (Helm chart at `ENDR/api/chart`, includes `Service` + `HTTPRoute`).
- `case.yaml`: CASE frontend app (Helm chart at `ENDR/portal/chart`, includes `Service` + `HTTPRoute`).
