# Cloudflare Tunnel Troubleshooting

Symptoms: the portal works at `http://127.0.0.1:3000` locally, but through the public Cloudflare
hostname **the page won't load at all** and **the ArgoCD embed is blank**.

## ✅ "Works, then goes unresponsive after visiting /argocd" (verified live 2026-06-13)

Different from the load failure below. Once the tunnel was up, the site worked initially but
became unresponsive over time, triggered by the **`/argocd` page**.

Root cause: the `/argocd` page (and service/platform detail pages) **auto-mounted the full ArgoCD
web UI in an iframe**. That UI opens long-lived **streaming watches**
(`/api/v1/stream/applications`, `.../resource-tree`) that run continuously. Left mounted on every
page view, it degrades the browser tab and churns the single shared `gateway-cloudflare` tunnel
connector (its log fills with `context canceled` on those stream URLs). The cluster itself stays
healthy (CPU ~0%, no OOM) — the failure is the always-on embedded streaming UI, not server load.

Fix (frontend): make the embed **load on demand**. `ArgoEmbedPanel`
(`ENDR/CASE/src/app/components/argo-embed-panel.tsx`) now renders a placeholder with a
**"Load embedded ArgoCD"** button + **"Open in new tab"** link, and only mounts the `<iframe>`
after an explicit click (with an "Unload" button to stop it). Live sync/health per service is
already shown natively in the catalog (`dataSource: argocd`), so the iframe is optional. Also
restored a bounded fetch timeout in `loadSnapshot` (`lib/plex.ts`) so a slow backend can't hang a
render. Verified: new image renders 0 `<iframe>` on `/argocd` vs 1 on the old image.

Deploy via GitOps (commit → `endr-build.yml` builds `case` image + bumps `ENDR/CASE/chart/values.yaml`
→ ArgoCD syncs). A local `kubectl set image` does NOT stick — the `platform`→`case` app-of-apps
self-heal reverts it.

## ✅ Confirmed root cause + fix (verified live 2026-06-13)

On a fresh `make bootstrap` of the full platform, the in-cluster Cloudflare controller
(`pl4nty/cloudflare-kubernetes-gateway`) could not bring up the tunnel because:

1. **The `cloudflare` Secret was missing.** The GatewayClass `parametersRef` points at Secret
   `cloudflare` in namespace `gateway` (keys `ACCOUNT_ID` + `TOKEN`). Bootstrap never creates it
   (correctly — it's a credential), so the Gateway sat at `Programmed: Unknown / Waiting for
   controller` and the controller logged `Secret "cloudflare" not found`.
2. **The controller does not watch the Secret.** After repeated errors it backed off, so simply
   *creating* the Secret afterward did **not** wake it up. **Fix: restart the controller** once the
   Secret exists: `kubectl -n cloudflare-gateway rollout restart deploy/cloudflare-controller-manager`.

After that, the controller programmed the tunnel, created DNS for `case`/`endr`/`argocd`/`<svc>`
`.calavelas.net`, and all hosts returned HTTP 200 (with `dataSource: argocd` live data).

**Operational rule:** create the `cloudflare` Secret *before* the controller starts, or restart the
controller after creating it. Verify with `kubectl get gateway gateway-cloudflare -n gateway` →
`Programmed: True`.

## Root cause (the other failure mode): two tunnels fighting over the same DNS

The repo ships **two independent Cloudflare ingress mechanisms**. Each one writes a Cloudflare DNS
CNAME for the public hostnames — but a hostname can point at only **one** tunnel, so they conflict.

| # | Mechanism | Defined in | Routes | Origin |
|---|---|---|---|---|
| 1 | **In-cluster gateway** (`pl4nty/cloudflare-kubernetes-gateway` v0.8.1, an ArgoCD app) | `KUBE/clusters/mac/lab/platform/cloudflare.yaml`, `gateway/gateway-cloudflare.yaml`, `gateway/route-cloudflare-{case,argocd}.yaml`, Secret `cloudflare` in ns `gateway` | `case.calavelas.net`, `endr.calavelas.net`, **`argocd.calavelas.net`** | in-cluster Services (`case:80`, `argocd-server:80`) directly |
| 2 | **Local script** (manual `cloudflared`, tunnel `endr-case`) | `ENDR/scripts/cloudflare-tunnel.sh` (`make tunnel-*`) | only **one** host (`CLOUDFLARE_TUNNEL_PUBLIC_HOSTNAME`) | `https://case.k8s.local` (via Traefik `*.k8s.local`) |

**Why it manifests:**
- `cloudflared tunnel route dns` (mechanism 2) and the in-cluster controller (mechanism 1) both
  claim the same hostname's CNAME. Whichever ran last owns it.
- If DNS points at a tunnel whose connector is **not running/healthy** (local `cloudflared` stopped,
  or the in-cluster controller's `cloudflare` Secret is missing/invalid so its tunnel never
  connects), Cloudflare returns **error 1033 / 530 → the page won't load at all**.
- Only mechanism 1 routes `argocd.calavelas.net`. If mechanism 2 took over `case.*` while `argocd.*`
  is left on a stale/dark record, the **embed is blank** even when the portal partially loads.

## Decision: run exactly ONE mechanism

Recommended: keep the **in-cluster gateway (mechanism 1)** — it is GitOps-native, declaratively
routes all three hosts including the ArgoCD embed, and needs no babysat local process. **Stop using
the local `cloudflare-tunnel.sh` concurrently** (it rewrites the DNS out from under the controller).

## Live verification checklist (run with the cluster up)

The cluster/tunnel must be running. Confirm which mechanism is live and healthy:

```bash
# 0. Is a competing local cloudflared running? (should be NONE if using mechanism 1)
pgrep -fl cloudflared

# 1. In-cluster gateway accepted + programmed?
kubectl -n gateway get gateway gateway-cloudflare -o jsonpath='{.status.conditions}' | python3 -m json.tool
kubectl get httproute -A            # case + argocd routes: Accepted, ResolvedRefs=True?

# 2. Controller + its tunnel connector healthy?
kubectl -n gateway get secret cloudflare -o jsonpath='{.data}' | python3 -m json.tool   # token/account/tunnel present?
kubectl -n cloudflare get pods
kubectl -n cloudflare logs deploy/cloudflare-gateway --tail=80   # connector "Registered tunnel connection"?

# 3. Backends exist?
kubectl -n endr get svc case
kubectl -n argocd get svc argocd-server

# 4. Cloudflare side (dashboard or API): for case/endr/argocd.calavelas.net,
#    which tunnel ID does the CNAME target, and is that tunnel HEALTHY (Zero Trust → Tunnels)?
```

Localize a 1033/blank with curl:

```bash
curl -sSI https://case.calavelas.net      # 1033/530 => DNS points at a dead tunnel
curl -sSI https://argocd.calavelas.net    # blank embed => this host unrouted/dark
```

## Fix — keep the in-cluster gateway (recommended)

1. Ensure the `cloudflare` Secret in ns `gateway` holds a valid API token + account/tunnel config
   (per the `pl4nty/cloudflare-kubernetes-gateway` docs). Re-sync the `cloudflare` ArgoCD app.
2. Confirm the controller connects (step 2 above) and the Gateway is `Programmed=True`.
3. In Cloudflare, ensure the CNAMEs for `case`/`endr`/`argocd.calavelas.net` target the
   controller-managed tunnel (delete stale records from the `endr-case` tunnel).
4. **Do not** run `make tunnel-start` while this is active. Stop any local `cloudflared`
   (`make tunnel-stop`) and delete the `endr-case` DNS routes if they exist.
5. ArgoCD CSP already allows framing from `case`/`endr.calavelas.net`
   (`KUBE/platforms/argocd/helm/values.yaml`, `server.content.security.policy`) — verify it matches
   the exact origin you serve.

## Fallback — local script only (no in-cluster Cloudflare)

If you deliberately prefer the manual tunnel:
- Disable mechanism 1: remove/disable the `cloudflare` ArgoCD app and the `gateway-cloudflare`
  routes so it stops claiming DNS.
- The script routes a single host; add an `argocd` ingress rule (and DNS) so the embed works, and
  ensure Traefik + its `*.k8s.local` TLS are healthy (the origin is `https://case.k8s.local`).

## Note on the cluster-free demo

The portal frontend was hardened so that with no `CASE_ARGOCD_EMBED_URL` set, `/argocd` shows a
graceful placeholder instead of a blank iframe. The cluster-free demo (`DOCS/DEMO_DEPLOY.md`)
sidesteps this whole tunnel/ingress problem — use it for the always-on portfolio link.
