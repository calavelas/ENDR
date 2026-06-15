# ENDR Portal — UI Design System

> **Read this before building any UI in `ENDR/portal/`.** It captures the existing
> design language so new features match it instead of drifting. It is the single
> enforcement reference for the portal's look, layout, responsiveness, and a11y.
>
> Scope: the Next.js portal (`ENDR/portal/src/app`). Source of truth for tokens is
> `globals.css`; this doc explains *how to use them*. When the two disagree, fix the
> doc — but never hardcode values that bypass the tokens.

---

## 0. The contract

Every new UI feature MUST:

1. Use **design tokens**, never raw hex / px literals for color, type, radius, shadow.
2. Use the **right font** — mono for headings/labels/data, sans for prose/marketing.
3. Render **flawlessly at all three reference viewports** (see §4) — verified, not assumed.
4. Ship **one `<h1>` and a per-page `<title>`**.
5. Work in **both themes** (dark default + light) and **both narrative modes** (IDP ⇄ Interstellar).
6. Produce **zero console errors** (no hydration mismatch, no failed fetches).
7. Reuse an **existing component pattern** (§6) before inventing a new one.

The Definition-of-Done checklist in §9 is the gate. A feature that fails any item is not done.

---

## 0.5 Reference page — match this

**The canonical layout standard is the service detail page** (`/application-services/<name>`,
e.g. `/application-services/case`). New feature pages should match its structure, density, and
component usage — it is the bar for hierarchy and polish. Its anatomy:

1. **Back link** — `‹ Back to <parent>` above the content.
2. **Hero panel** (`mc-panel mc-detail-hero`): eyebrow label (mono, muted) → large mono title →
   one-paragraph body copy (sans) with inline `code` chips → a row of **status badges**
   (health/sync) + **meta chips** (namespace, image) on the left, **primary actions**
   right-aligned (GitHub / ArgoCD / Decommission).
3. **Segmented tab bar** (Overview / Readme / Files / ArgoCD) — mono.
4. **Two-column info panels** (`mc-panel` + `mc-kv` definition lists): grouped + labelled,
   values mono for IDs/paths, collapse to one column on mobile.
5. **Secondary panels** below (Deployed Commit + status badges, Live Resources) — same
   `mc-panel` shell.
6. Renders correctly in **both themes**, stacks cleanly to a single column on mobile,
   one `<h1>`, per-page `<title>`.

**Patterns to replicate:** `mc-panel` cards · `mc-kv` key/value lists · health/sync **badges** ·
eyebrow→title→copy hero · right-aligned action buttons · mono for labels/IDs, sans for prose.
Don't ship a page looser or noisier than this.

---

## 1. Tokens (from `globals.css`)

**Always reference these. Never hardcode the underlying values** — hardcoding breaks theming.

### Color — use the `--mc-*` set (themed: dark + light)
| Token | Role |
| ----- | ---- |
| `--mc-bg` | page background |
| `--mc-surface` / `--mc-surface-2` | panel / raised panel |
| `--mc-line` / `--mc-line-bright` | borders / emphasized borders |
| `--mc-ink` / `--mc-ink-2` | primary / secondary text |
| `--mc-muted` / `--mc-faint` | muted / faint text |
| `--mc-good` / `--mc-warn` / `--mc-bad` / `--mc-info` | status (health/sync/etc.) |

**Brand accent:** `--accent` `#37d3c3` (cyan-teal), `--accent-strong`, `--accent-soft` (12% wash), `--accent-contrast` (text on accent). Accent = "this is interactive / this is ENDR." Use sparingly — it loses meaning if everything is cyan.

> ⚠️ **Token drift:** an older flat set (`--bg`, `--text`, `--muted`, `--good-text`, `--fs-*`,
> `--radius-*`, `--shadow`) also exists. **Prefer `--mc-*` for new work** — it's the set with
> light-theme overrides. Don't introduce a third namespace.

### Type scale
`--fs-xs .74rem` · `--fs-sm .84rem` · `--fs-base .95rem` · `--fs-lg 1.1rem` · `--fs-xl 1.4rem`.
Hero/display sizes use `clamp()` (see §3). Don't invent off-scale sizes.

### Shape & depth
Radius: `--radius-sm .5` / `--radius-md .75` / `--radius-lg 1` / `--radius-xl 1.25rem`.
Shadow: `--shadow` (panels/hover), `--shadow-sm` (subtle).

### Layout
`--sidebar-w 236px` · `--header-h 78px`. Use these, don't re-measure the shell.

### Theming rule
Dark is default; light is a `--mc-*` override block. **Any new color must be a `--mc-*` token**
so it flips with the theme. If you write `color:#fff`, light theme breaks — that's a bug.

---

## 2. Fonts

| Family | Token | Use for |
| ------ | ----- | ------- |
| **JetBrains Mono** | `--font-mono` | headings, section titles, labels, KPIs, IDs, code, data, nav. The terminal/ops aesthetic — this is the ENDR voice. |
| **Inter / Manrope** | `--font-body` | body copy, descriptions, marketing prose on the landing. |

This split is **intentional**: the in-app UI reads like a control surface (mono); the landing
markets (sans). Don't "unify" it away. Just apply it consistently — a body paragraph in mono or a
heading in sans is the drift to avoid.

---

## 3. Typography & headings

- **One `<h1>` per page.** In app-shell pages the `<h1>` is the shell's `.app-title` (top bar);
  in-content heroes are `<h2>` (`.mc-detail-hero-title` etc.). Chromeless pages (§4) use the
  page's `.lp-title` as the single `<h1>`.
- **Per-page `<title>`.** Server pages export `metadata`; dynamic routes use `generateMetadata`;
  client pages get a sibling server `layout.tsx` carrying `metadata`. Never ship the root title on
  a sub-page.
- **Hero sizing** uses `clamp(min, vw, max)` so it scales — but the **`min` must fit the smallest
  viewport** (a single long word at the min size must not overflow 390px). See §4 lesson.
- Headings wrap, they don't truncate (`white-space: normal`). Truncating a title drops meaning.

---

## 4. Layout & responsive — the core of enforcement

### The two shells
- **App shell** (`app-*`): sidebar + header + content. Default for operational pages
  (dashboard, catalog, create, history, detail).
- **Chromeless** (`lp-*` / `uh-*`): full-bleed, own header, no sidebar. For landing-style /
  reference pages. **A page is chromeless only if it's in `CHROMELESS_ROUTES`** (`app-shell.tsx`).
  If you build a landing-style page with `lp-*`/`uh-*` classes, you MUST add its route there —
  otherwise it renders inside the dashboard shell and breaks on mobile.

### The three mandatory viewports (mirrors `NXUS.md` → "Web & UI Development")
Test **portrait + landscape where relevant**. Pass = no horizontal page scroll and nothing clipped.

| Format | Logical viewport |
| ------ | ---------------- |
| iPhone | ~390 × 844 |
| iPad Pro | 1024 × 1366 / 1366 × 1024 |
| MacBook Pro 14″ | ~1512 × 982 |

**Pass criterion (objective):** `document.documentElement.scrollWidth === window.innerWidth`
at each width. If `docW > viewport`, something overflows — find and fix it (§5 gives the usual
suspects). Verify with the harness in §10, not by eyeballing one screen.

### Breakpoints
The codebase currently has **13 different `max-width` breakpoints** (520→1320px) — that's debt.
For **new** CSS, standardize on:
- `≤ 520px` — phone
- `≤ 1024px` — tablet / collapse multi-column
- `> 1024px` — desktop

Don't add a 14th bespoke breakpoint unless a component genuinely needs it.

---

## 5. Responsive gotchas (these caused real bugs — don't repeat them)

1. **Flex children that hold wide content need `min-width: 0`.** A flex item defaults to
   `min-width: auto` and won't shrink below its content's min-content width — a wide table or long
   token then stretches the whole column past the viewport. Set `min-width: 0` on the flex
   item so `overflow-x: auto` can actually contain it. (This chains: fix every link from the
   content up to the page.)
2. **Grid tracks: use `minmax(0, 1fr)`, never bare `1fr`** when a cell can contain non-wrapping
   content. `1fr` = `minmax(auto, 1fr)`; `auto` = min-content, which blows the track out.
3. **Wide tables go in a scroll container.** `.uh-table-wrap { overflow-x: auto; min-width: 0 }`
   around the `<table>`. The table may exceed the viewport *inside its box* — that's fine; the
   page must not.
4. **Long mono strings (paths, IDs) need `overflow-wrap: anywhere`** when shown in cards, or they
   force horizontal overflow. (In tables they stay `nowrap` and scroll instead.)
5. **Hero/display text must fit at the min clamp size** on a 390px screen — a single big word can
   overflow even when the container is correct.

---

## 6. Component patterns (reuse before inventing)

| Need | Use | Notes |
| ---- | --- | ----- |
| App page chrome | `app-shell` (sidebar/header) | adds the `<h1>` + page title bar |
| Panel / card | `mc-panel`, `mc-card`, `uh-card` | token bg/line/radius; don't restyle borders ad-hoc |
| KPI / stat | `stat-card` / `mc-kpi` | value + label + hint; tones `mc-good/warn/bad` |
| Status badge | health/sync badge (`good/warn/bad/info` tones) | one shape, semantic color only |
| Buttons | `mc-btn` (app) · `lp-btn` (landing) | variants: `-primary/-soft/-ghost/-link/-lg/-sm` |
| Key/value detail | `mc-kv` (`<dl>`) | `dd` has `word-break`; collapses to 1-col on mobile |
| Table | `<div class="uh-table-wrap"><table class="uh-table">` | always wrap (§5.3) |
| Section anchors | `uh-section` + anchor chips | for long reference pages |
| Narrative toggle | `nrt-toggle` (app) · `lp-seg` (landing) | give it a `title` + descriptive `aria-label` |
| Floating assistant | assistant FAB | content needs a bottom gutter so the FAB never overlaps it |

If none fit, propose a new pattern in this doc *before* shipping it — don't fork a one-off style.

---

## 7. Narrative modes (IDP ⇄ Interstellar)

The portal speaks two registers, switched by the narrative toggle: **IDP** (plain DevOps terms)
and **Interstellar** (themed). Any user-facing string with a themed variant must be provided
through the narrative system (`useNarrative` / `narrative.tsx`) — **never hardcode** one register.
New copy ships both variants or it's mode-agnostic. Test both modes (§9).

---

## 8. Accessibility & correctness

- **One `<h1>` + per-page `<title>`** (§3).
- **Touch targets ≥ ~44px** on interactive controls.
- **Icon-only controls get a `title` + `aria-label`** (the sidebar rail, the assistant FAB, the
  theme/narrative toggles).
- **Deterministic SSR — no hydration mismatches.** Never render locale/timezone-dependent output
  (`Date#toLocaleString()` with no fixed locale/timeZone) during SSR; it differs server vs client
  → React error #418. Format dates with a fixed locale + `timeZone` (UTC for ops timestamps), or
  render client-only.
- **Client fetches go same-origin** (`/api/platform`), not an absolute base — the gateway proxies
  `/api/*`. An absolute/localhost base from the browser = `ERR_CONNECTION_REFUSED`.

---

## 9. Definition of Done — new-UI checklist

Copy into the PR. All must be checked.

- [ ] Colors/type/radius/shadow use **tokens** (`--mc-*` / `--accent` / `--fs-*` / `--radius-*`) — no raw hex/px.
- [ ] **Mono** for headings/labels/data, **sans** for prose — applied consistently.
- [ ] Exactly **one `<h1>`** and a **per-page `<title>`**.
- [ ] **No page overflow** at 390 / 1024 / 1512 (`docW === viewport`), portrait + landscape — verified with the harness (§10), screenshots attached.
- [ ] **Light theme** renders correctly (toggle it).
- [ ] **Both narrative modes** render correctly (IDP + Interstellar).
- [ ] **Zero console errors** — no hydration #418, no failed/refused fetches.
- [ ] Interactive controls: **≥44px targets**, icon-only ones have `title` + `aria-label`.
- [ ] Reused an existing **component pattern** (or documented a new one here).
- [ ] If landing-style: route added to **`CHROMELESS_ROUTES`**.

---

## 10. How to verify (the harness)

Drive headless Chrome at each viewport, assert no overflow, capture full-page screenshots:

```js
// puppeteer-core against the system Chrome
for (const [w, h] of [[390,844],[1024,1366],[1512,982]]) {
  await page.setViewport({ width:w, height:h });
  await page.goto(url, { waitUntil: 'networkidle0' });
  const { docW, vw } = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth, vw: window.innerWidth }));
  console.assert(docW === vw, `overflow at ${w}: docW=${docW}`);
  await page.screenshot({ path: `ui-${w}.png`, fullPage: true });
}
```
To localize an overflow, list every element wider than the viewport
(`getBoundingClientRect().width > innerWidth`) and fix from the page down.

---

## 11. Anti-patterns (codified from real incidents)

- ❌ Hardcoded hex/px instead of tokens → breaks theming.
- ❌ Bare `1fr` grids / flex items without `min-width:0` → mobile overflow (§5).
- ❌ `toLocaleString()` in SSR'd output → hydration #418 (§8).
- ❌ Absolute/localhost API base in the browser → `ERR_CONNECTION_REFUSED` (§8).
- ❌ Landing-style page not in `CHROMELESS_ROUTES` → dashboard sidebar squeezes it on mobile.
- ❌ Same `<title>` on every route; multiple `<h1>`s per page.
- ❌ **Auditing UI mid-deploy** → false positives from a stale pod. Verify against the rolled-out build.
- ❌ A new `--xx-*` token namespace → consolidate on `--mc-*`.

---

*Keep this current: when a new pattern or token lands, document it here in the same PR.*
