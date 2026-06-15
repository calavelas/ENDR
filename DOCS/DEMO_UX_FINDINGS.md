# ENDR demo — cold-eval UX findings

_Two evaluators drove the live site (https://endr.calavelas.net) with **no prior
knowledge** of how ENDR works and no access to the source — exactly like a first-time
visitor. One played a **non-technical layperson** in Interstellar mode; one played a
**senior DevOps engineer** in IDP mode. Each tried to create a service, follow the
delivery, use the robot chat, and decommission. Findings below are ranked by impact._

## Headline

The platform is **real, not mocked** — the DevOps evaluator independently verified
(via `gh`) the full chain: create → PR → CI gate → auto-merge → reconcile (chart +
ArgoCD app committed) → image build → decommission PR. The architecture page and the
robot's claims checked out. The friction is almost entirely in the **"what happens
after I click Create"** window: a fresh service is briefly invisible/unmanageable in
its own UI, the assistant talks past that state, and concurrent users collided on a
shared file.

## Findings (ranked)

### 1. Concurrent creates collided on `services.yaml` — second PR stuck open · HIGH · FIXED
Both evaluators created a service at the same time; both PRs appended to the single
shared `services.yaml`, so the second hit a merge conflict, never auto-merged, and the
service never deployed. The layperson could then never decommission it (it never
appeared). This is the real-world "multiple people at once" failure.
- **Fix shipped:** `.gitattributes` sets `services.yaml merge=union` so simultaneous
  additions keep both entries and merge cleanly; the auto-merge job also updates a
  behind branch before merging. reconcile re-renders from `services.yaml` and the API
  re-validates at merge time, so the catalog stays the source of truth.

### 2. A just-created service 404s on its own page for minutes · HIGH · PLANNED (portal)
Both evaluators clicked the post-create "Open service page" link and got
**"404 — This page could not be found."** for 6+ minutes (ArgoCD/portal registration
lag). Because **Decommission lives only on that page**, the service is also
un-teardownable through the UI during that window. Reads as broken even though it's
just deploying.
- **Recommended:** render a "still deploying — created, not yet synced" state on the
  service route instead of a hard 404; and/or surface the new service in the
  catalog/dashboard immediately with a "provisioning" badge.

### 3. The assistant narrates a page state it can't see · HIGH · PARTIALLY ADDRESSED
On the 404 page the chat confidently said _"This is the page for tryout-svc — a live
service…"_ and offered _"How do I calibrate tryout-svc?"_ — describing a page that
isn't there. Confidently wrong erodes trust.
- **Fix shipped (robot chat):** the service-detail guidance now hedges — if the page
  shows "not found", it tells the user the unit is **still launching, give it a
  minute**, instead of asserting it's live.

### 4. Post-create guidance strands non-technical users · HIGH · ADDRESSED (robot chat)
Every "next step" after Create pointed to **GitHub and ArgoCD** — tools the layperson
had never heard of — with no in-product "watch it appear here." The layperson said
_"it dumped me into GitHub/ArgoCD/YAML land… I never saw my robot come alive."_
- **Fix shipped (robot chat):** the post-create guidance now says the PR **auto-merges
  itself** (no "go merge it" confusion), tells users their service **appears on the
  dashboard in a minute or two**, and adds a "where is it? / it's not showing up yet"
  reassurance thread that sets expectations (incl. the 404-while-launching).

### 5. Heavy jargon in the create flow · MED · PARTIALLY ADDRESSED
The create intro and chips assume Git/YAML/K8s vocabulary ("pull request", "reconcile
workflow", "Helm chart", "services.yaml", "No kubectl", "gargantua", "helm-service").
The layperson understood almost none of it; raw code blocks during creation were
intimidating.
- **Fix shipped (robot chat):** plainer Interstellar phrasing on the create/deploy
  steps. **Recommended (portal):** add a one-line plain-English "what's about to
  happen" above the create form and collapse the raw YAML/file-tree by default.

### 6. Chat is canned chips only — no free text · MED · BY DESIGN (documented)
Both wanted to type their own question ("how do I roll back?", "how do I make *my*
robot go live?") and couldn't. The robot is a deterministic scripted guide (no LLM in
the pod), so chips are intentional — but it oversells as a "copilot."
- **Recommended:** broaden the chip set for the common real questions and/or label it
  honestly as a guided tour, not free-form chat.

### 7. Portal pipeline status disagrees with reality · MED · PLANNED (portal)
Delivery history showed `tryout-svc` pipeline **PENDING** while CI had actually
SUCCEEDED (verified via `gh`). The audit view under-reports. (Live polling was removed
earlier to save resources, leaving a stale badge.)
- **Recommended:** drop the misleading PENDING badge, or link out to the PR's checks
  instead of showing a stale state.

### 8. Assistant messages render twice · LOW · PLANNED (portal)
Each assistant bubble appears twice in the DOM.

### 9. Default narrative was Interstellar for the DevOps evaluator · LOW · LIKELY TEST ARTIFACT
A practitioner first saw "Build a robot. Launch it across the galaxy," which undercut
credibility before the IDP framing. This was almost certainly stale `localStorage` in
the shared test browser (the real default is IDP); worth confirming a fresh visitor
lands in IDP.

## What worked well (keep)
- **It's genuinely end-to-end and verifiable** — real PRs, real CI gates, real ArgoCD
  artifacts; the DevOps evaluator's headline praise.
- **Create wizard**: 4 steps, live two-way Form⇄YAML, and a Review step showing the
  full file diff before committing — "exactly the pre-merge confidence a GitOps
  engineer wants."
- **Under-the-hood / architecture page**: coherent, accurate, honest about guardrails.
- **The Interstellar toggle** is a real emotional hook for non-technical visitors.
- **TARS/CASE personality** lands; the technical answers are accurate.

## Gaps a real IDP would still need (from the DevOps eval, for the roadmap)
Rollback UX · secrets management · multi-env promotion · real RBAC/SSO ·
observability depth (logs/metrics/traces) · more templates · org policy/quotas.

## Round 2 — re-eval after fixes (layperson, full lifecycle)
A fresh naive layperson re-ran the whole journey and **completed it end to end**:
created `tryout-nova` → watched it go **Provisioning → live/HEALTHY** → talked to the
assistant → **decommissioned it easily** (one confirm). Confirmed fixed/working:
- Concurrency (#1): no conflict.
- Provisioning state (#2): once the create PR merged, the service page showed
  _"PROVISIONING — This robot is on its way"_ and auto-refreshed to live, instead of 404.
- Assistant (#3/#4): context-aware — _"if it's showing 'not found', it just hasn't
  finished launching… watch the fleet… healthy, the moment it's ready,"_ with a button
  to the dashboard. No longer claims a missing page is live.
- Decommission: clear button → confirm → PR. "Smoothest part."
- Stale pipeline badge (#7): gone.

**Residual closed after round 2:** clicking "Open service page" in the first ~30–60s
(before the create PR merges, so it's not in the catalog yet) still hit a hard 404.
Fixed: the service route now **never hard-404s** — it shows a "being created → on its
way → live" auto-refreshing gradient across the whole window.

Remaining (lower priority): jargon on the default IDP landing (Interstellar mode is
much clearer); the assistant panel can overlap the create form on narrow viewports.

## Round 3 — parallel re-eval (layperson + DevOps + junior dev)
Three personas re-ran the full lifecycle; **all completed it** (create → provisioning →
live → decommission). Highlights:
- **Layperson** (`tryout-luna`): live in ~2.5 min, decommissioned in two clicks. New
  nit: a stray rapid click on "Add variable" seemed to reset the create form (couldn't
  reproduce a clear cause — the button is a safe `type=button`; flagged for manual repro).
- **DevOps** (`tryout-orbit`): everything verified against `gh`. Found decommission
  left the **workload running** (see below).
- **Junior dev, no ops** (`tryout-pixel`): shipped unaided — the chat genuinely taught
  it GitOps. Friction: the decommission "Refresh → Sync → Prune" ask was the only ops-y
  step, and namespace choice had no guidance.

**Root cause found + fixed — orphaned workloads on decommission (HIGH).** Child ArgoCD
Applications had **no `resources-finalizer.argocd.argoproj.io`** (verified live: child
apps report `finalizers: None`). So when the app-of-apps prunes a child Application, the
object is removed but its Deployment/Service/route are **orphaned and keep running
indefinitely** — not just lagging. Fixes:
- Added the finalizer to the child-app template → future decommissions cascade-delete.
- ArgoCD auto-refresh (separate change) removes the ~3-min polling wait on create/decommission.
- Decommission guidance updated: it's now **automatic** (no manual Refresh/Sync/Prune).
- One-time manual cleanup is needed for services decommissioned *before* the finalizer
  (their Applications are already gone) — `kubectl delete deployment,service,httproute <name> -n <ns>`.

Also fixed this round: the post-decommission/unknown service page now shows neutral
copy (not "being created"); the assistant drawer becomes a bottom sheet below 1024px so
it no longer covers the create form's Next/Create buttons.

## Scenario completion
| Step | Layperson (Interstellar) | DevOps (IDP) |
|---|---|---|
| Understood what it is | Partly | Yes |
| Created a service | Yes (PR opened) | Yes (verified merged) |
| Talked to a robot | Yes | Yes |
| Decommissioned it | No (stuck — finding #1/#2) | Partial (teardown works on a registered service) |

The decommission gaps trace to findings #1 and #2 — both now fixed/planned.
