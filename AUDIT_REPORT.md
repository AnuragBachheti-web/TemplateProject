# Action Stories — Staff+ Production Readiness Audit

**Scope:** `src/features/action-stories/**`, `src/services/actionStoriesService.js`, `src/store/useActionStoriesStore.js`, `extraction/**`.
**Method:** full source read of every routing/service/renderer/block/validator/style file, cross-checked against real manifest JSON + real fixture JSON on disk, cross-checked against the project's own internal QA tool (`extraction/audit-report.md`, generated **2026-09-10T08:20:09Z**). No live browser session was available in this environment (`claude-in-chrome` extension not connected) — every rendering claim below is a **static trace of code + real data**, not a screenshot. Where a claim depends on visual confirmation I could not get, it is marked **NOT VERIFIABLE FROM CURRENT REPOSITORY**.

**Important calibration note (read this first):** this codebase is being actively edited. A `find -newer` pass shows `StageRenderer.jsx`, the entire block registry, `blockTypes.js`, and all 26 manifest files were rewritten **today, within the last few hours**, adding five dedicated chart block types (`barChart`/`lineChart`/`scatterChart`/`waterfallChart`/`heatmapGrid`) on Recharts, a grid-layout heuristic, and richer field-preservation logic. Some artifacts in the repo — `INTEGRATION.md` ("recharts... is still unused"), and an earlier version of this same guide I wrote for you in this session — describe the **previous** state and are now **stale**. This audit is against what is on disk right now. Treat it as a snapshot; re-run `npm run audit` before acting on anything here that depends on exact counts.

---

## 1. EXECUTIVE VERDICT

| Question | Verdict |
|---|---|
| Production-ready today? | **No.** |
| Architecture fundamentally sound? | **Yes, with one real gap.** The manifest→bind→validate→registry pipeline is a legitimate, well-tested pattern. The gap: block *classification* (which shape a field gets rendered as) is non-deterministic across otherwise-identical data, and layout composition has no declarative model at all (§11). |
| UI production-quality? | **No.** It is a competent internal-tools/prototype aesthetic (consistent tokens, no dark-mode entry point, no real heading hierarchy, dense scalar-card walls on ~60% of stages per the project's own audit). Not something you point a paying customer at unmodified. |
| Is the rendering genuinely dynamic? | **Partially — Level 1–3 solid, Level 4–10 weak or absent.** See §6. "JSON-driven" is true; "backend can compose a screen" is not. |
| Can it safely consume real backend data? | **No, not as-is.** `getStageData`/`getWorkflowIndex` have zero network-error handling, zero retry/cancellation beyond a `cancelled` flag, and the manifest vocabulary itself has two fields (`execution_lane`, `guardrail_verdict`) that INTEGRATION.md's own analysis says will silently show **wrong data** once wired to the real `/v1/proposals` schema. See §13. |
| Charts robust? | **No.** The chart *components* (Recharts-based) are well-built in isolation. The chart *classifier* feeding them is not: the project's own audit tool found **9 confirmed cases** of the identical `{label, value}` shape rendered as a bar chart in some workflows and a plain list in others, plus **6 more chart-shaped fields still misclassified as lists**, plus at least one confirmed unit-scale bug I traced by hand (§8). |
| Tables robust? | **Structurally yes** (union-of-columns, decorative-key filtering, horizontal scroll). **No sorting, filtering, pagination, sticky header, or truncation-with-tooltip** — fine at today's row counts (single/low-digit rows per fixture), a real gap at production scale. |
| Biggest architectural gap | No declarative **layout** model — width/order/grouping is entirely a client-side heuristic (`isGridEligible`) reacting to *type*, never something a manifest or backend can actually specify. |
| Biggest UI gap | Dark-mode CSS (tokens, `dark:` classes) is fully authored everywhere but **there is no toggle, no `useThemeStore`, no `data-theme` writer anywhere in this app** — it is unreachable dead styling, not a working feature. |
| What blocks production sign-off | (1) No error boundary — a single component-level exception white-screens the whole stage, not just one block. (2) Zero backend-network error/timeout/empty handling. (3) Non-deterministic chart-vs-list classification proven by the project's own tooling. (4) Zero accessibility affordances (0 `aria-*`, 1 `<h1>` in the entire feature). (5) Approve/Start button is 100% decorative — no mutation exists. |

### SCORECARD (0–10, 10 = ship it)

| Dimension | Score | One-line why |
|---|---|---|
| Architecture | 6 | Clean separation (routing/service/manifest/render/registry); undermined by a layout model that doesn't exist and a classifier that isn't deterministic. |
| Dynamic rendering | 5 | Values, block-type-per-slot, and workflow/stage set are genuinely data-driven. Order, grouping, width, styling, actions, visibility are not. |
| UI quality | 4 | Consistent tokens and restrained typography; undercut by uniform card monotony, 60–84% scalar-card density on many stages, and zero heading hierarchy. |
| Visual consistency | 6 | One token system, one card shape everywhere — consistent by construction. Chart-vs-list classification inconsistency breaks this at the data layer. |
| Data handling | 6 | `resolveBinding`/`validateBlockData` never throw; genuinely good defensive coding. Undermined by silent per-field data loss the project's own audit already quantifies (20 confirmed cases). |
| Charts | 4 | Well-built Recharts wrappers; fed by an unreliable classifier and (for scatter) an unflipped SVG-y-coordinate bug I traced in real fixture data (§8). |
| Tables | 6 | Solid basics, no scale features (sort/filter/paginate/sticky). |
| Interaction/action handling | 3 | Only one real action (Approve/Start) and it performs no business operation — confirmed decorative by its own code comment and a `TODO`. |
| Error handling | 4 | Manifest/binding/validation errors are handled beautifully. Network errors and render exceptions are not handled at all. |
| Loading/empty states | 4 | Empty-state components exist and are used consistently inside blocks. Page-level loading is a bare "Loading…" string; the sidebar has **no** loading state. |
| Responsive behavior | 5 | Tailwind responsive classes exist (`sm:`/`lg:` grid); untested below desktop, fixed `w-64` sidebar never collapses, chart heights are fixed px not viewport-aware. |
| Accessibility | 2 | 0 `aria-*` attributes, 1 semantic heading in the whole feature, no focus-visible styling audited, table headers are the only real semantic win. |
| Maintainability | 7 | Genuinely good: tests exist for every validator and every block's empty/error path, code comments are unusually honest about known gaps. |
| Backend readiness | 3 | Service-layer swap point is real and clean; nothing else about the boundary (errors, timeouts, empty responses, schema drift) is handled. |
| **Production readiness (overall)** | **4 / 10** | Strong foundation, not yet a product a customer should see. |

---

## 2. CURRENT ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ROUTING            App.jsx (react-router)                               │
│                    /action-stories            -> Shell -> ActionStoriesHome │
│                    /action-stories/:code/:stageKey -> Shell -> StagePage │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │ useParams()
┌───────────────────────────────▼───────────────────────────────────────────┐
│ DATA ACCESS        services/actionStoriesService.js                     │
│                    getWorkflowIndex()  <- import.meta.glob(index.json)  │
│                    getStageData(code, stageKey)                         │
│                       <- import.meta.glob(manifests/*.json)             │
│                       <- import.meta.glob(data/raw/*/*.json)            │
│                    NO axios/fetch/http client wired despite axios       │
│                    being a listed dependency (grep-confirmed: 0 uses)   │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │ { manifest, fixture }
┌───────────────────────────────▼───────────────────────────────────────────┐
│ SCHEMA / VALIDATION  manifests/validateManifest.js (shape of the manifest)│
│                       manifests/blockTypes.js  (13 validate<Type> fns)   │
│                       manifests/resolveBinding.js (dot-path resolver)   │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │ per-block: resolved value
┌───────────────────────────────▼───────────────────────────────────────────┐
│ RENDER ENGINE      components/StageRenderer.jsx                         │
│                    - resolveBinding -> validateBlockData -> registry    │
│                    - isGridEligible/groupIntoRows: the ONLY layout logic│
│                      that exists anywhere in this system                │
│                    - owns slider cross-block state (overrides)          │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │ blockType string
┌───────────────────────────────▼───────────────────────────────────────────┐
│ BLOCK REGISTRY     blocks/index.js — 13 entries, 1:1 with BLOCK_TYPES    │
│                    text number flag labelValueList table itemQueue      │
│                    lineChart barChart scatterChart waterfallChart       │
│                    heatmapGrid object slider                            │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────────────────────┐
│ BLOCK COMPONENTS   13 pure functions, no hooks except SliderBlock's      │
│                    controlled input. Each: EmptyState/ErrorState guard, │
│                    then its own render. Chart blocks wrap Recharts.     │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────────────────────┐
│ DESIGN SYSTEM      styles/tokens.css (auto-gen, light+dark rf-* vars)    │
│                    styles/chart-tokens.css (hand-authored chart colors) │
│                    tailwind.config.js reads tokens.css at build time    │
│                    Dark mode CSS exists; NO activation mechanism exists │
└─────────────────────────────────────────────────────────────────────────┘

STATE (outside the tree above):
 - useActionStoriesStore.js (Zustand): confirmedStages only. No workflow/stage
   state — that lives in the URL by design (correct, and explicitly documented).
 - StageRenderer's own useState: sliderPositions/overrides (local, ephemeral).
```

---

## 3. ACTUAL URL → SCREEN FLOW (traced, not assumed)

Route: `/action-stories/S9.1/reason`

| # | File : Function | Responsibility | In | Out | Failure mode actually handled |
|---|---|---|---|---|---|
| 1 | `App.jsx` | Route match | URL | mounts `Shell` | none needed (react-router) |
| 2 | `components/Shell.jsx` | Sidebar + outlet | — | `getWorkflowIndex()` → `workflows` state | `catch` sets `error` state, rendered as one line; **no loading state for the sidebar list itself** — it just renders an empty `<ul>` until the promise resolves |
| 3 | `pages/StagePage.jsx: StagePage` | `key={code/stageKey}` remount wrapper | `useParams()` | forces `StagePageContent` to fully remount per navigation | Deliberate design (documented) to avoid stale-state flicker — verified correct |
| 4 | `pages/StagePage.jsx: StagePageContent` | Fetch + compose | `code, stageKey` | `{workflow, manifest, fixture}` | `Promise.all([...]).catch` → error text. **No distinction between "network down," "404 workflow," "malformed JSON," or "empty response"** — all three collapse to the same one-line message via `error.message` |
| 5 | `services/actionStoriesService.js: getStageData` | Load 2 JSON modules via `import.meta.glob` | `code, stageKey` | `{manifest, fixture}` | Throws plain `Error` on a missing manifest/fixture path; `validateManifest` problems are only `console.warn`ed, **never surfaced to the UI** — a structurally-invalid manifest still renders |
| 6 | `manifests/resolveBinding.js` | Dot-path walk | `binding, fixture` | value or `undefined` | Verified never-throws (tested) |
| 7 | `manifests/blockTypes.js: validateBlockData` | Shape check per declared type | `blockType, value` | `[]` or problem strings | Verified never-throws (tested); **cannot catch semantic errors** — e.g. it will happily pass a `barChart` array whose 3 rows have units of "ratio," "dollars," and "percent" (§8) |
| 8 | `components/StageRenderer.jsx` | Registry lookup + grid grouping | `manifest.blocks[]` | array of `{key, gridEligible, node}` | Unknown type / undefined value / validation failure → `BlockPlaceholder`, `console.warn`. **No React error boundary** — an exception thrown *inside* a block's own render (not caught by any of the above) is not caught here either |
| 9 | `blocks/index.js` lookup → concrete block component | Final render | resolved+validated value | JSX | Each block re-checks null/undefined/wrong-type defensively (belt-and-suspenders, confirmed by reading all 13) |
| 10 | Browser paint | CSS via `rf-*` tokens, Tailwind utility classes | — | pixels | Fixed light-mode palette effectively always active (dark tokens unreachable, §16) |

**Assumption baked into step 5 that a real backend will violate:** the manifest and the fixture are loaded as two *separate* artifacts that must stay in lockstep (same `code`, same `stageKey`, same set of `slotName`s the frontend expects). Nothing enforces this pairing beyond a developer regenerating both together. `INTEGRATION.md` itself proposes serving them from a single `{ manifest, fixture }` endpoint precisely to keep this coupling explicit — but nothing in the current code would detect drift if a future backend served them independently and let them skew.

---

## 4. FIXED VS DYNAMIC MATRIX

| Surface | Classification | Evidence |
|---|---|---|
| App shell / sidebar chrome | **FIXED** (React) | `Shell.jsx` markup is hardcoded; only the *list of workflow links* is data-driven |
| Workflow navigation (which workflows exist) | **DATA-DRIVEN** | `data/index.json`, will be **BACKEND-DRIVEN** once `getWorkflowIndex()` is swapped |
| Stage navigation (which stages, in what order) | **DATA-DRIVEN** | `workflow.stages[]` from the same index; `StepTracker.jsx` reads count, doesn't assume 4 (S10.6's 5-stage "live" case is real evidence this works) |
| Page layout (header / tracker / body / action bar) | **FIXED** (React) | Hardcoded JSX skeleton in `StagePage.jsx` — a manifest cannot add/remove/reorder these regions |
| Section layout inside the body | **NOT IMPLEMENTED as a concept** | There is no "section" abstraction anywhere. A stage is one flat `blocks[]` array |
| Block selection (which block type per slot) | **DATA-DRIVEN, but not RELIABLY** | `manifest.blockType` decides the component; the project's own audit proves the *same underlying data shape* gets a different `blockType` in different workflows (9 confirmed groups, §8) |
| Block ordering | **DATA-DRIVEN** (array order) — but re-grouped by a **FIXED heuristic** | `groupIntoRows` in `StageRenderer.jsx` silently reorders adjacent scalar blocks into a grid; the manifest's literal array order is not what gets painted |
| Block positioning / sizing | **HARDCODED (CSS/heuristic), not configurable** | `isGridEligible()` decides 1/2/3-column grouping by *type + key count*, purely client-side; **no manifest field exists to request a width, a column-span, or a placement** — see §11 |
| Block styling | **FIXED** (Tailwind classes baked into each block component) + design-token driven colors | A manifest cannot change a block's visual treatment beyond what its type's component hardcodes |
| Block data | **DATA-DRIVEN / eventually BACKEND-DRIVEN** | via `resolveBinding` |
| Charts | **DATA-DRIVEN**, classification computed **build-time** by `extraction/classifyBlocks.js`, not runtime | The manifest bakes in a fixed `blockType` per chart at generation time; there is no runtime chart-type inference — a real backend would need to either replicate this classifier server-side or the manifest becomes a second, backend-owned artifact |
| Tables | **DATA-DRIVEN** (columns = union of row keys) | `TableBlock.jsx` |
| Buttons (Approve/Start) | **PARTIALLY DATA-DRIVEN label, FIXED visibility rule** | `ctaLabel` binding (data-driven text) but `stageKey !== 'decide' && stageKey !== 'execute'` visibility check is **hardcoded in React** (`StageActionBar.jsx:12`) — a manifest cannot add a button to a `reason`/`analyze` stage, or remove it from `decide`/`execute` |
| Button state (confirmed/disabled) | **CLIENT STATE ONLY** | Zustand store, never persisted server-side |
| Button actions | **DECORATIVE — no backend call exists** | `confirmStage` only flips local state; `TODO(action-stories-mutations)` literally says so |
| Permissions | **NOT IMPLEMENTED** | No auth, no role check, anywhere in this feature |
| Loading states | **FIXED** (identical string everywhere) | `<div>Loading…</div>` literal in `ActionStoriesHome.jsx` and `StagePage.jsx`; **absent** in `Shell.jsx`'s sidebar |
| Error states | **FIXED presentation, DATA-DRIVEN message** | `{error.message}` interpolated into fixed markup |
| Empty states | **FIXED per block type**, consistent | `BlockStates.jsx`'s `EmptyState`/`ErrorState`, reused everywhere — a genuine design-system win |

**Direct answers:**
- **What can the JSON decide?** Which block-shape renders in a slot, what data that block shows, how many workflows/stages exist, the button's label text.
- **What can the backend decide** (once wired)? Everything the JSON currently decides, nothing more — the backend inherits the exact same ceiling.
- **What is hardcoded in React, unreachable by any JSON today?** Page skeleton/regions, section concept (absent), block width/positioning, button visibility rule, permissions, loading/error chrome.
- **What is controlled only by CSS?** Block visual style/spacing/color roles (`rf-*` tokens), dark-mode values (present but unreachable — no toggle exists).
- **What would require a frontend code change?** Any new block *type*; any change to page-level layout regions; any change to button visibility rules; any actual mutation wiring; any section/grouping concept.

---

## 5. DYNAMICNESS LEVEL — DO NOT USE "DYNAMIC" LOOSELY

| Level | Status | Evidence | What would need to change |
|---|---|---|---|
| 1. Dynamic values | **SUPPORTED** | `resolveBinding` + fixture JSON | — |
| 2. Dynamic block types | **SUPPORTED, but not reliable** | 13 types, registry-driven; **but** `extraction/audit-report.md`'s A.4 section proves the *same* `{label,value}×N` shape is classified `barChart` in some workflows and `labelValueList` in ~30 others — the "which type" decision is a heuristic guess frozen at generation time, not a stable contract | A slotName's blockType needs to be pinned by a real schema/contract per concept (e.g. "this is always a KPI row, always rendered the same way"), not re-guessed per workflow by a shape heuristic |
| 3. Dynamic block ordering | **PARTIAL** | Manifest array order is respected *until* `groupIntoRows` silently re-buckets adjacent scalars into a grid — the rendered order is a derived transformation of the declared order, not the declared order itself | Either make grid-grouping an explicit manifest instruction, or accept and document that "order" is advisory only |
| 4. Dynamic layout / positioning / sizing | **NOT SUPPORTED** | No manifest field for width/columns/placement exists anywhere in the 26 manifest files (verified: every block object has exactly 3 keys — `slotName`, `blockType`, `binding`) | Add a layout primitive to the manifest schema (§20) |
| 5. Dynamic styling/theming within constraints | **NOT SUPPORTED at the manifest level** | Styling is 100% inside each block component; a manifest cannot request "emphasize this," "use the critical tone," etc. Dark-mode *theming* exists in CSS but has **no activation path** in this app (`useThemeStore.js` referenced by `tailwind.config.js`'s own comment does not exist in this repo — 0 results) | Either add a per-block "tone"/"emphasis" binding the component reads, or accept styling is a code-only concern |
| 6. Dynamic actions/buttons/commands | **NOT SUPPORTED** | Exactly one action exists (`StageActionBar`'s Approve/Start), its visibility rule (`stageKey === 'decide' \|\| 'execute'`) is hardcoded, and it performs no operation | Actions would need their own manifest concept (`actions: [{type, label, endpoint}]`) plus a real command dispatcher |
| 7. Dynamic visibility/conditional rendering | **NOT SUPPORTED** | No block carries a condition; a block either has a binding that resolves (renders) or doesn't (placeholder/empty) — that's a data-presence check, not conditional logic | Would need a `visibleIf` expression evaluated against fixture data — and a decision about how much expression power is safe (§14 security concern) |
| 8. Dynamic interaction behavior | **ONE CASE ONLY** | The slider→"steps"-lookup mechanism (`sliderSteps.js`) is genuinely data-driven interaction — but it is bespoke to one block type, unused by any of the 105 real fixtures today, and not a general pattern | Would need to become a general "this block's interaction updates these other slots" contract, not a slider-only special case |
| 9. Dynamic workflow/stage configuration | **SUPPORTED** | `data/index.json` genuinely drives workflow count, names, and per-workflow stage set (S10.6's 5-stage case proves this isn't hardcoded to 4) | — |
| 10. Fully backend-driven screen composition | **NOT SUPPORTED** | Composition = "which blocks, what order, what grouping, what page chrome." Only "which blocks" and "what data" are backend-reachable today. Grouping is a client heuristic; chrome is hardcoded React | This is the real ceiling of the current architecture — see §20 for what closing this gap would actually require |

**Bottom line: this is a Level-1/2/3(partial)/9 system being described (elsewhere, including in a guide I wrote earlier this session) as "backend-driven screen composition." It is not that yet — it is "backend-driven block selection and values inside a fixed page shell with a client-side layout heuristic."**

---

## 6. UI QUALITY AUDIT

**Overall read: internal engineering-tools aesthetic, not SaaS-polished.** Reasons, with files:

- **Uniform card monotony.** Every one of the 13 block types renders the same `rounded-lg border border-rf-border-subtle bg-rf-surface-canvas` card shell (confirmed identical class string across `TextBlock.jsx`, `NumberBlock.jsx`, `ItemQueueBlock.jsx`, `TableBlock.jsx`, `ObjectBlock.jsx`, `LabelValueListBlock.jsx`, `BarChartBlock.jsx`, `LineChartBlock.jsx`, `ScatterChartBlock.jsx`, `WaterfallChartBlock.jsx`, `HeatmapGridBlock.jsx`, `SliderBlock.jsx`, `FlagBlock.jsx`). Consistency is good; **zero visual hierarchy between "this is a headline metric" vs "this is a footnote"** is not — a KPI and a one-line disclaimer get the identical card treatment.
- **Scalar-card wall.** The project's own `extraction/audit-report.md` quantifies this precisely: **61 of 105 stages exceed 40% scalar-block density**, several at 70–84% (e.g. `S10.6/decide`: 26/31 blocks are scalar). `StageRenderer.jsx`'s new `isGridEligible`/`groupIntoRows` was clearly written in direct response to this and helps, but the report has not been re-run since, so the actual post-fix density is **NOT VERIFIABLE FROM CURRENT REPOSITORY**.
- **Zero heading hierarchy.** `grep` across the entire feature: exactly **one** `<h1>` (`StagePage.jsx:52`) in the whole application. Every block's own "title" (e.g. "RATIONALE", "GUARDRAIL VERDICT") is a styled `<p>`, not a semantic heading. A sighted user reading top-to-bottom sees a hierarchy the markup doesn't have.
- **No section boundaries.** A `decide` stage with 23 blocks (S9.1) is one undifferentiated vertical list (occasionally interrupted by a grid row) with no group headers, no dividers beyond each card's own border, no way to tell "these 6 blocks are the guardrail panel" from "these 4 are the hero metrics" except by reading every label.
- **Dark mode is dead weight.** Every block ships `dark:` Tailwind variants and `tokens.css`/`chart-tokens.css` define a full `[data-theme="dark"]` palette — real, non-trivial authoring effort — but **no code anywhere sets `data-theme` on `<html>`**, and `useThemeStore.js` (referenced by `tailwind.config.js`'s own comment as the mechanism) does not exist in this repository. A user has no way to ever see the dark theme this app was clearly built to support.
- **Chart sizing is cramped.** `BarChartBlock`/`ScatterChartBlock` fix chart height at `h-20` (80px), `LineChartBlock` at `h-20`/`h-24` (80–96px), only `WaterfallChartBlock` gets `h-32` (128px). At 80px tall with axis labels/tooltips crammed in, these read as sparklines, not charts a user would trust for a real decision — undercutting the "decision support" purpose of the whole product.
- **Leftover, unused design-system surface area.** `tailwind.config.js` defines `brand`/`brand-hover`/`brand-subtle`/`danger`/`danger-hover`/`danger-text`/`cb-200`…`cb-900` Tailwind colors reading from CSS custom properties (`--color-brand`, `--cb-500`, etc.) that **are not defined anywhere in `src/index.css` or `tokens.css`** (grep-confirmed) and are **never used** by any class name in the codebase (grep-confirmed). Dead config inherited from the target `realifyai` app this scaffold will merge into — harmless today, but it means the design-token surface a new engineer sees in `tailwind.config.js` is partly fictional relative to what this app actually renders with (`rf-*` tokens only).

---

## 7. CHART AUDIT

Charts are Recharts-based (`BarChartBlock`, `LineChartBlock`, `ScatterChartBlock`, `WaterfallChartBlock`, `HeatmapGridBlock` — the last is a hand-rolled CSS grid, not a chart library primitive, by deliberate and reasonable choice per its own comment). **`recharts` is in fact wired up now** — contradicting `INTEGRATION.md`'s "still unused" note, which is now stale (§17). The component code itself is competent: theme-reactive `var(--token)` colors passed straight into Recharts fill/stroke props, `ResponsiveContainer` used correctly, tooltips formatted from the original display string rather than the parsed number, empty/error guards on every component.

**The actual problems are upstream of the components, in classification and data-shape fidelity — confirmed with real fixture data, not assumed:**

1. **Confirmed unit-scale bug (traced by hand): `S9.1/decide`'s `guardrail_verdict` slot.** Manifest binds it `blockType: "barChart"`, `binding: "data.checks"`. The real fixture (`data/raw/S9.1/decide.json`) contains three governance rows whose `value` fields are `"2.31"` (a ratio), `"$440K"` (a dollar figure), `"5.6%"` (a percent). `chartGeometry.js`'s `parseMagnitude` turns these into `2.31`, `440000`, `5.6` — three numbers spanning five orders of magnitude plotted as three bars on one shared linear y-axis. The `$440K` bar will visually dwarf the other two into invisible slivers. **Root cause:** `extraction/classifyBlocks.js`'s `isBarChartShaped()` only checks that a magnitude-like key is *present* per row — it does not check that the *values across rows share comparable units* — so a checklist with heterogeneous metrics gets the same `barChart` treatment as a genuine same-unit series.
2. **The same class of bug is independently confirmed at scale by the project's own audit tool.** `extraction/audit-report.md`'s §A.4 groups blocks by structural "shape signature" across all 26 workflows and finds **9 strict groups** where the identical shape (e.g. `n=4|keys=label,value|types=string,string`) is classified `'barChart'` in a handful of workflows (`S9.1/decide.totals`, `S10.4/execute.attrRows`, `S9.16/decide.expRows`, `S9.7/decide.summary`, `S9.11/reason.targets`, `S9.12/decide.rlStats`, `S10.1/decide.recurrence`, `S9.13/decide.totals`, `S9.17/decide.summary`) and `'labelValueList'` in ~60 structurally-identical others. This is not one bug in one workflow — it is **proof the classifier is not deterministic with respect to meaning**, only to superficial shape, and a user moving between two workflows sees the same kind of business fact (e.g. "SKUs touched: 56" alongside three dollar figures in `S9.1/decide.totals`) rendered as a bar chart in one place and a plain list everywhere else.
3. **Confirmed scatter-chart Y-axis inversion (traced from real fixture data + code, not run):** `chartGeometry.js`'s `parseSvgPathPoints` (used by `LineChartBlock`) explicitly negates the parsed Y value (`y: -y`) with the comment *"SVG y grows downward... otherwise a rising trend would visually plot as falling."* `ScatterChartBlock.jsx` reads the same class of raw SVG-coordinate data (`item?.y ?? item?.cy`, confirmed against `S9.1/analyze.points` — 150+ points with literal `cx`/`cy` SVG pixel coordinates from the original mockup, `cy` ranging ~70 at the top of the original artwork to ~235 at the bottom) via `toNumber(item?.y ?? item?.cy)` **with no negation**. Recharts' Cartesian y-axis grows upward; the source data's y grows downward. **Every scatter chart sourced from raw mockup SVG coordinates renders vertically inverted relative to its original design** — the exact bug class `LineChartBlock` was explicitly written to avoid, left unfixed one file over. This is a code-diffable inconsistency, not a guess: compare `chartGeometry.js:19` (`y: -y`) against `ScatterChartBlock.jsx:19-20` (no negation).
4. **Confirmed categorical data loss in scatter charts:** `S9.1/analyze.points` carries a `hue` field per point with 6 distinct values (matching the 6 SKU roles shown in the same stage's `roles` table — Hero/Core/Margin Driver/Traffic Driver/Supporting/Exit Candidate). `ScatterChartBlock.jsx` always plots every point with `fill={categoricalColor(0)}` — a single fixed color, ignoring `hue` entirely. The original visual (a segmentation scatter plot) becomes an undifferentiated blob of ~150 same-colored dots in this system.
5. **Confirmed information loss in waterfall tooltips:** `S10.1/analyze.bars` rows carry a real semantic `tag` field (`"unexpected"`, `"our action"`, `"expected"`) distinguishing *why* a variance driver moved. `WaterfallChartBlock.jsx`'s tooltip only shows the raw `value`; `tag`/`sublabel` are read by nothing in the component. A user hovering a bar cannot see the one piece of context (was this expected or not?) the mockup's own data was clearly designed to convey.
6. **Confirmed under-classification remaining after today's 5-chart-type refactor:** `extraction/audit-report.md`'s §A.2 lists **6 fields that still look chart-shaped by a broader geometry vocabulary but were not classified as any of the 5 chart types** — `S9.1/decide.moveBar`, `S9.3/analyze.curves` (literally an SVG path field named `path`), `S9.4/analyze.points`, `S9.9/analyze.fy`/`ladders`/`cliffs` — all currently rendered as `labelValueList`, i.e. a flat text list of raw coordinate-shaped data.
7. **Chart-overlay composition is lost.** `S10.2/analyze` has both `p10Path` (`lineChart`) and `netDots` (`scatterChart`) — both share the identical evenly-spaced x-domain (`0, 75, 150, 225...`), strongly suggesting the original mockup overlaid the dots on the line (a percentile band with sample points). This system renders them as two separate, unrelated chart cards stacked vertically — there is no manifest or renderer concept of "these two chart primitives are one composition."
8. **Sizing:** fixed `h-20`/`h-24`/`h-32` (80/96/128px) containers via `ResponsiveContainer` — width is responsive, height is not, and is uncomfortably small for a chart meant to support a real decision.
9. **Adding a future chart type:** the architecture handles this well — one new file in `blocks/`, one registry line, one validator, matching the existing pattern exactly (this part of the "no code change to the engine" claim is **true and verified**, unlike the layout claim in §5/§11).

---

## 8. TABLE AUDIT

`TableBlock.jsx` — the only table implementation.

| Concern | Status | Evidence |
|---|---|---|
| Column sizing | Auto (browser table layout), `whitespace-nowrap` on numeric cells only | Fine at current row/column counts |
| Horizontal overflow | Handled | `overflow-x-auto` wrapper |
| Vertical overflow | **Not handled** | No max-height/scroll region — a 200-row table renders 200 `<tr>`s inline, pushing the whole page down |
| Long strings | Partially handled | `max-w-xs` + no wrap control beyond default — no truncation-with-tooltip; a long text cell will wrap and blow out row height inconsistently across rows |
| Missing/null values | Handled via `flattenDisplayValue` → `''` | Renders as a blank cell, not a dash/placeholder — a real empty cell is visually indistinguishable from "this column doesn't apply here" |
| Numeric alignment | Handled | `isNumericValue` right-aligns + monospaces numeric-looking cells |
| Header styling | Consistent, decorative-key filtered | Good |
| Sorting | **Not implemented** | No click handler on `<th>` |
| Filtering | **Not implemented** | — |
| Pagination | **Not implemented** | Fine at today's fixture sizes (single/low-digit rows); a real backend table could return hundreds of rows with nothing to page them |
| Sticky header | **Not implemented** | Only matters once vertical scroll exists, which it doesn't yet either |
| Accessibility | Semantic `<table>/<thead>/<tbody>` — genuinely correct base HTML | No `scope="col"` on headers, no caption/summary |
| Large datasets | **Untested, no safeguard** | Nothing caps row count; a 5,000-row API response renders 5,000 DOM rows with no virtualization |

**Why tables "look scattered" (if that's the complaint) — precise cause:** it is very unlikely to be `TableBlock.jsx` itself (it is one of the more solid components audited). The more likely cause is **composition**, not the table: a `decide` stage mixes 15+ scalar cards with 1–2 tables in one undifferentiated vertical list with no section grouping (§6/§11) — the table looks "lost in a sea of cards," not internally broken.

---

## 9. BLOCK AUDIT

| Block | Purpose | Validates? | Empty | Error | Responsive | A11y | Prod-readiness | Known gap |
|---|---|---|---|---|---|---|---|---|
| Text | one string | ✅ | ✅ | ✅ | n/a | plain text, fine | High | none found |
| Number | one finite number | ✅ | ✅ | ✅ | n/a | fine | High | none found |
| Flag | one boolean | ✅ | ✅ | ✅ | n/a | fine | High | none found |
| LabelValueList | rows of `{label, value\|...}` | ✅ | ✅ | ✅ | wraps text, ok | correct `<ul><li>` list semantics | High | drops any extra array-typed field beyond the "extra entries" scan one level deep (2 confirmed real cases: `S9.13/decide.groups[].items`, `S9.16/analyze.plRows[].cells`) |
| Table | tabular rows | ✅ | ✅ | ✅ | h-scroll only | good base HTML, no v-scroll | Medium | see §8 |
| ItemQueue | rich variable-shape items | ✅ (loose by design) | ✅ | ✅ | `line-clamp-2` on detail text | no list semantics beyond native `<ul><li>` | High | headline-picking heuristic (`HEADLINE_KEYS` etc.) is a best-effort guess, not a contract — will silently pick a "wrong" field as the headline on new data shapes |
| BarChart | magnitude comparison | ✅ (shape only, not unit) | ✅ | ✅ | width-responsive, fixed height | Recharts default (partial) | **Low-Medium** | unit-scale mismatch (§8.1), no category color |
| LineChart | trend | ✅ | ✅ | ✅ | same | same | Medium-High | best-built chart block; multi-series legend logic is correct and tested |
| ScatterChart | plotted points | ✅ (shape only) | ✅ | ✅ | same | same | **Low** | Y-inversion bug + categorical-color loss (§8.3/8.4), both confirmed |
| WaterfallChart | bridge/variance | ✅ | ✅ | ✅ | rotated x-labels (`angle=-30`) risk overlap at >6 categories, untested | same | Medium | drops `tag`/`sublabel` semantic context (§8.5) |
| HeatmapGrid | 2D matrix | ✅ | ✅ | ✅ | `overflow-x-auto` | `title` attr for hover detail (better than nothing, not screen-reader-equivalent) | Medium | primary-metric selection is **positional** (first numeric key found in object-iteration order) — fragile, silently changes if a future API reorders JSON keys (§ below) |
| Object | descriptor dl | ✅ | ✅ | ✅ | `truncate` on values | `<dl>` is correct semantic choice | High | drops arrays/objects nested 2+ levels deep (documented limitation, matches project's own audit findings) |
| Slider | interactive range | ✅ | ✅ | ✅ | native `<input type=range>` | native control, reasonably accessible | Medium | **0 of 105 real fixtures use this block** — it is fully untested against real data, exists only for a hypothetical future "simulate" feature |

**Cross-cutting, confirmed by the project's own `extraction/audit-report.md` §A.3 (20 real, named instances, not hypothetical):** every block that summarizes a rich item (`LabelValueListBlock`'s "extra entries", `ObjectBlock`'s `renderEntryValue`, `ItemQueueBlock`'s nested-list scan) only recurses **one level deep**. Real fixtures with 2+ levels of nesting (e.g. `S10.1/analyze.drill` → dropped `rows`; `S9.17/execute.brief` → dropped `sections`+`ladder`) silently lose that data today, with **zero visual indication** anything is missing — this is the single highest-value fix candidate in the entire codebase (see §19 P1).

---

## 10. LAYOUT AUDIT — who decides what

| Question | Answer | Evidence |
|---|---|---|
| Who decides where a block appears (order)? | The manifest's array order, **then silently re-bucketed** by `groupIntoRows` | `StageRenderer.jsx:31-47` |
| Who decides a block's width? | `isGridEligible()` — a **hardcoded type+key-count heuristic in React**, never the manifest | `StageRenderer.jsx:23-29` |
| Who decides a block's height? | Each block component's own fixed Tailwind classes (e.g. chart `h-20`) | per-component |
| Who decides spacing between blocks? | Fixed: `gap-3` on the flex column, `gap-3` on the grid | `StageRenderer.jsx:136,141` |
| Who decides if two blocks sit side-by-side? | The same `isGridEligible` heuristic — text/number/flag/small-object only | same |
| Who decides if a chart spans half or full width? | **No one, explicitly** — every chart type is excluded from `isGridEligible` (`return false` for anything not text/number/flag/small-object), so every chart is always full-width regardless of how small its content is |
| Who decides section boundaries? | **No one** — sections do not exist as a concept |
| Who decides responsive stacking? | Tailwind breakpoints on the grid (`sm:grid-cols-2 lg:grid-cols-3`) — fixed, not manifest-controlled |
| Who decides ordering vs. grouping conflicts (e.g. a chart between two groupable scalars)? | The chart breaks the grid — `groupIntoRows` closes the current grid the moment a non-eligible item appears, so `[text, text, chart, text, text]` renders as `[grid-of-2][chart][grid-of-2]`, not `[grid-of-4]` |

**Verdict: 1. hardcoded in React** for width/grouping, **3. derived from block order** for sequence (with the caveat above), **NOT (4) manifest-driven, NOT (5) backend-configurable** for any spatial property. This is the honest answer to "how are blocks positioned" — currently, *type* is the only signal, and it lives entirely in `StageRenderer.jsx`, not in any JSON a backend team could edit without a frontend deploy.

**Recommended production model (not a rewrite — additive):** give each manifest block an optional `layout: { span: 1|2|3, group?: string }` hint, defaulting to today's `isGridEligible` heuristic when absent (so all 105 existing fixtures keep working unchanged). `StageRenderer` groups by explicit `group` id when present, falls back to the current type-heuristic otherwise. This is a **schema addition, not an engine rewrite** — the registry/resolve/validate pipeline is untouched.

---

## 11. SCREEN COMPOSITION AUDIT — three real workflows, reconstructed

**S9.1 / reason** (small stage, 5 blocks — `manifests/S9.1.json`):
```
SCREEN
├── Header (StagePage.jsx, hardcoded): code + workflow name + StepTracker
├── Body (StageRenderer)
│   ├── [grid: rationale(text), execution_lane(text)]   ← grouped by isGridEligible
│   ├── policy (labelValueList) — full width
│   ├── roles (table) — full width
│   └── inputs (labelValueList) — full width
└── Action Bar: hidden (reason stage is not decide/execute)
```
Declarative? **Which blocks + their data: yes. Grouping into that one 2-up row at the top: no** — that's `isGridEligible` inferring it from type, not the manifest saying "put these two together."

**S9.1 / decide** (large stage, 23 blocks, 65% scalar per the project's own audit):
```
SCREEN
├── Header + StepTracker (fixed)
├── Body
│   ├── [grid: execution_lane, guardrail_blocked, guardrail_can_approve, guardrail_cta_label, ...]
│   ├── guardrail_verdict (barChart ← MISCLASSIFIED, see §8.1)
│   ├── [grid: slateName, confLabel, heroTitle, heroSub]
│   ├── heroMetrics (barChart)
│   ├── moveBar (labelValueList)
│   ├── slates (itemQueue)
│   ├── [grid: approvedCount, toggleAllLabel]
│   ├── groups (table)
│   ├── [grid: focusTitle, focusMeta]
│   ├── focusRows (table)
│   ├── [grid: focusFooter, ...]
│   ├── totals (barChart ← MISCLASSIFIED per §8.2/audit A.4)
│   └── [grid: policyStatus, footStatus, ...]
└── Action Bar: "Approve" button (decorative, §12)
```
This is the stage that best demonstrates the real limitation: 23 blocks in declaration order, with **zero grouping semantics** beyond "adjacent scalars happen to batch together" — a user cannot tell from the rendered page which 4-5 blocks are "the guardrail panel" vs "the hero metrics panel" vs "the approval list," because that grouping exists only in the author's head, not in the manifest or the render.

**S10.6 / live** (the one 5-stage workflow, 35 blocks, 71% scalar):
```
SCREEN
├── Header + StepTracker (5 stages: reason→analyze→decide→execute→live — proves stage count is genuinely dynamic)
├── Body: 35 blocks incl. lensTiles (per REPORT.md, a `lens` value — but classified generically, no special "live tile" component exists)
└── Action Bar: hidden (live is not decide/execute — StageActionBar.jsx:12's hardcoded check)
```
Confirms: stage-count dynamism is real and well-built (§5, Level 9). Composition-level declarativeness is not — same flat-list-plus-heuristic-grid pattern as every other stage, regardless of how semantically different a "live monitoring" screen conceptually is from a "reason" screen.

---

## 12. BACKEND READINESS AUDIT

| Concern | Status |
|---|---|
| API contract assumptions | `getStageData` assumes a `{manifest, fixture}` shape will keep arriving together — real if `INTEGRATION.md`'s proposed single endpoint is built; **breaks silently otherwise** |
| Schema/runtime validation | `validateManifest`/`validateBlockData` exist and are genuinely good — but their failures are **`console.warn` only**, never shown to a user or reported to any monitoring/telemetry (there is none) |
| Versioning / backward compatibility | **Not designed for at all** — no schema version field, no migration path if a future manifest shape adds a field this frontend doesn't expect (it would just be ignored, silently) |
| Unknown block types | Handled gracefully (`BlockPlaceholder`) — genuinely good |
| Missing/malformed fields | Handled per-block (Empty/Error states) — genuinely good |
| Null/empty API responses | `getWorkflowIndex()` returning `[]` renders "No workflows found." (`ActionStoriesHome.jsx:37`) — handled. An empty/null **fixture** for a valid manifest is not specifically tested but should degrade to many `EmptyState` blocks — plausible, **not verified end-to-end** |
| Network errors / timeouts | **Not handled at all.** `getStageData`/`getWorkflowIndex` are plain async functions with no timeout, no retry, no distinction between "4xx," "5xx," "offline," and "malformed JSON" — all become one `error.message` string |
| Race conditions | **Handled correctly** — every fetching component (`Shell`, `ActionStoriesHome`, `StagePage`) uses the `let cancelled = false` + cleanup-function pattern to ignore a stale response after unmount/param-change. This is real, verified, good engineering. |
| Caching / stale data | **None** — every navigation re-fetches from scratch (acceptable for local JSON, will be a real cost/latency question once it's a real network call) |
| Request cancellation (actual `AbortController`) | **Not implemented** — the `cancelled` flag prevents *acting* on a stale response but does not actually cancel the in-flight request |
| Auth / permissions | **Not implemented, not even stubbed** |
| Error messaging quality | Raw `error.message` shown directly to the end user — **acceptable for a scaffold, not for production** (could leak implementation detail from a thrown error) |
| **Field-mapping correctness** (the biggest concrete risk) | `INTEGRATION.md` — written by whoever built this scaffold, and worth taking seriously — states plainly that **`execution_lane` and `guardrail_verdict` are name collisions with the real `/v1/proposals` API**, not matches: `execution_lane` here means "Suggest/Assist" (a UI display mode); the real field means "who executes" derived from a `guardrail_verdict` enum. `guardrail_verdict` here is a `checks` array; the real field is a 4-value enum. **Wiring the real API in without remapping these two fields will silently show wrong information to a real user**, per that document's own explicit warning. |

**Is "local JSON → real API" a drop-in replacement? No — not safely.** The *function signature* swap is real and clean (confirmed: `getWorkflowIndex`/`getStageData` are the only two functions every call site depends on). Everything *around* that swap — error handling, the two known field-semantic collisions, schema drift detection — is unaddressed.

---

## 13. BUTTON / ACTION AUDIT

Only one interactive action exists in the entire feature: the Approve/Start button (`StageActionBar.jsx`).

| Question | Answer |
|---|---|
| UI defined where | `StageActionBar.jsx` |
| State stored where | `useActionStoriesStore.js` (Zustand, in-memory, per `code/stageKey`) |
| What happens on click | `confirmStage(code, stageKey)` → `set()` a boolean, nothing else |
| Backend mutation exists? | **No.** `TODO(action-stories-mutations)` is a literal comment in the store file itself, naming the exact future endpoint (`POST /v1/action-stories/:code/:stageKey/confirm`) |
| Loading state during the action | **N/A — there is no async operation to wait on** |
| Failure state | **N/A — nothing can fail; it's a local `set()`** |
| Success state | The button relabels to "Confirmed"/"Done" and disables — purely a local UI reflection |
| Duplicate-click protection | Yes, incidentally — `disabled={isConfirmed}` |
| Idempotent | Trivially, since it's local state |
| Refresh preserves state | **No.** Zustand's default in-memory store is wiped on reload — a "confirmed" stage reverts to unconfirmed the moment the page refreshes |
| Permission check | **None** |
| **UI exists vs. UI performs the business operation** | **UI exists. It does not perform any business operation.** This is explicitly, honestly documented in the code's own comments — not a hidden gap, but still a hard blocker for any real "approve a workflow stage" claim about this product |

**Navigation "actions" (sidebar links, step tracker links):** these are real — genuine `<NavLink>` React Router navigation, not decorative. No gap here.

---

## 14. ERROR / EMPTY / LOADING STATE AUDIT

- **Manifest/binding/block-validation errors:** genuinely excellent, three-layer defense (`resolveBinding` never throws → `validateBlockData` never throws → `StageRenderer` catches both plus unknown types → visible amber placeholder + `console.warn`). **Verified in code, matches its own documentation claim.**
- **A block whose own render function throws a real JS exception** (not a validation failure — an actual bug, e.g. a Recharts internal error on a pathological input, or a null-deref the defensive checks didn't anticipate): **not caught by anything.** There is no `ErrorBoundary` anywhere in `src/` (grep-confirmed, 0 hits for `ErrorBoundary`/`componentDidCatch`/`getDerivedStateFromError`). Per React's default behavior, this unmounts the entire component tree below the nearest boundary — i.e., **the whole stage goes blank**, not just the one bad block. This directly contradicts the aspiration (stated in this project's own `INTEGRATION.md`-adjacent comments) that "no bad manifest entry ... [is] an invisible gap in production" — that claim is true for the *known* failure modes, false for an *unknown* one.
- **Page-level loading:** a bare `<div>Loading…</div>` string, identical in `ActionStoriesHome.jsx` and `StagePage.jsx`. No skeleton, no spinner (grep-confirmed 0 hits for "skeleton"/"spinner" anywhere in `src/`).
- **Sidebar loading:** **absent.** `Shell.jsx` initializes `workflows` to `[]` and renders an empty `<ul>` with no loading indicator until the fetch resolves — a slow network would show an empty sidebar with no explanation.
- **404 / missing workflow or stage:** handled as a thrown `Error` → same generic one-line red text as every other error. No distinct "this workflow doesn't exist" UX (no redirect to a 404 page, no suggestion).
- **Malformed manifest (structurally invalid):** `validateManifest` catches it, but only logs to console — **the malformed manifest still renders**, whatever that produces (could be anything, since the type-check that would have caught it was only warned about, not enforced).

---

## 15. RESPONSIVE AUDIT

- Grid grouping does respond to breakpoints (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) — a real, if narrow, responsive behavior.
- The sidebar (`Shell.jsx`) is a **fixed `w-64`**, no collapse/hide behavior at any breakpoint — on a narrow viewport this permanently eats 256px of width from the content area.
- Chart heights are fixed px (`h-20`/`h-24`/`h-32`); width is responsive via `ResponsiveContainer` but a fixed height on a narrow, tall mobile viewport produces an oddly letterboxed chart, not a redesigned mobile layout.
- Tables rely entirely on `overflow-x-auto` — functional but not a real "mobile table" pattern (no column priority/hide, no card-per-row fallback).
- **NOT VERIFIABLE FROM CURRENT REPOSITORY:** actual rendered behavior at tablet/mobile widths, since no live browser session was available this pass. The above is inferred from the Tailwind classes present, not observed.

---

## 16. ACCESSIBILITY AUDIT

Concrete, counted, not generic WCAG advice:

- **0** `aria-*` attributes anywhere in `src/features/action-stories/` (grep-confirmed).
- **0** `role="..."` attributes anywhere in the same tree.
- **1** semantic heading (`<h1>`, `StagePage.jsx:52`) in the entire feature — every block "title" is a styled `<p>`, so a screen-reader user navigating by heading finds exactly one landmark no matter how information-dense the stage is.
- Tables use correct native `<table>/<thead>/<tbody>/<th>` (a real, if partial, accessibility win) but no `scope="col"`.
- `StageActionBar`'s button is a real `<button>` (correct semantics, keyboard-operable by default) — the one clean interactive element in the feature.
- Sidebar/step-tracker navigation uses real `<NavLink>` (renders an `<a>`) — correct, keyboard-navigable.
- Slider uses a native `<input type="range">` — correct semantics, but no visible label association (`<label htmlFor>`) beyond adjacent text, and no `aria-valuetext` for the unit-suffixed value.
- Color is used as the *only* signal for severity (`severityTone.js`'s colored dot) with no text/icon backup beyond the state badge that happens to sit next to it in `ItemQueueBlock` — for `LabelValueListBlock`/`ObjectBlock` rows a tone-only color would be the sole signal if any of those types rendered severity (they currently don't bind it, so this is latent, not active).
- No `focus-visible` styling was found configured beyond Tailwind/browser defaults (not explicitly audited pixel-by-pixel; **NOT VERIFIABLE FROM CURRENT REPOSITORY** without a live browser check).
- Chart accessibility: Recharts renders SVG with no `<title>`/`<desc>` or table-alternative fallback for any of the 5 chart blocks — a screen-reader user gets nothing from a chart beyond whatever the surrounding card label says.

---

## 17. DESIGN SYSTEM / CONSISTENCY

- **One real, working token system:** `rf-*` CSS custom properties (auto-generated, light+dark values defined), consumed via Tailwind's `rgb(var(--x-rgb) / <alpha-value>)` pattern. Used consistently by every block component audited. This part is genuinely good and worth preserving as-is.
- **One real, working chart-color system:** `chartPalette.js` + `chart-tokens.css`, deliberately validated against a documented color-formula methodology, categorical/sequential/status roles kept separate on purpose (a more rigorous approach than most internal tools bother with).
- **One dead design-system fragment:** the `brand`/`danger`/`cb-*` Tailwind colors in `tailwind.config.js`, backed by CSS variables that don't exist in this repo and classes that are never used — leftover from the target app this scaffold merges into (§6).
- **One authored-but-unreachable design-system fragment:** dark mode. Full token coverage, zero activation path.
- **Card shape duplication:** the exact string `"rounded-lg border border-rf-border-subtle bg-rf-surface-canvas"` (or a `px-4 py-3` variant of it) is repeated verbatim across all 13 block components rather than factored into one shared `<BlockCard>` wrapper. Not a bug, but a real duplication — a future "add a subtle shadow to every card" change touches 13 files instead of 1.
- **Severity/status color duplication:** `severityTone.js` hardcodes its own Tailwind literal classes (`bg-rose-500`, `bg-amber-500`, etc.) rather than the `rf-status-*` tokens already defined in `tokens.css` for exactly this purpose (`--rf-status-critical`, `--rf-status-warning`, `--rf-status-success`) — two parallel status-color systems exist in the same codebase (one token-based, one Tailwind-literal), and `severityTone.js` uses the wrong one relative to the rest of the design system.

---

## 18. ARCHITECTURE QUALITY

- **Separation of concerns: good.** Routing / service / schema-validation / binding-resolution / rendering / registry / components are cleanly split across files with single responsibilities, verified by reading all of them.
- **Is `StageRenderer.jsx` a god component?** **Borderline, trending that way.** It now owns: binding resolution orchestration, validation orchestration, registry dispatch, slider cross-block state, AND layout/grouping logic (`isGridEligible`/`groupIntoRows`). That last responsibility is new (added in today's session) and is a different *kind* of concern (presentation/layout) from the rest (data pipeline orchestration) — it is the first crack in an otherwise single-responsibility file. Not yet a god component, but the trend (layout heuristic added on top of an already-busy renderer) is the one to watch before a 6th concern gets bolted on the same way.
- **Are blocks genuinely dumb/render-only?** **Yes, verified.** Every block is a plain function (only `SliderBlock` takes an `onChange` callback, and its own comment explains why it deliberately holds no internal state — testability). This is a real, well-reasoned architectural choice, confirmed by the test suite calling every block as a bare function with no React renderer.
- **Service layer:** clean, and its future swap point (§12) is real. Minor gap: `validateManifest`'s output is discarded into `console.warn` rather than propagated as part of the return value/thrown error, so a caller has no way to *act* on "this manifest is invalid" short of grepping dev-console output.
- **Testability:** genuinely good — every validator, every block's empty/error/valid path, `resolveBinding`, and `findNearestStep` have direct unit tests (468 lines of test code across 5 files, confirmed by reading them). **Gap:** no test exercises `StageRenderer`'s own grouping logic (`isGridEligible`/`groupIntoRows`), and no test loads real manifest+fixture pairs from `data/raw` end-to-end to assert zero blocks fall through to `BlockPlaceholder` — which is exactly the class of bug (§8) that slipped through to the shipped manifests.

---

## 19. SCALABILITY

| Scale change | What scales fine | What breaks / gets hard |
|---|---|---|
| 26 → 100 workflows | Routing, service layer, registry — all workflow-count-agnostic by construction | Manual manifest/fixture authoring effort scales linearly with no tooling gap *yet*, but the classifier's non-determinism (§8) gets proportionally more instances to manually catch |
| 104 → 500+ screens | Same | The "no section/layout concept" gap (§11) becomes a bigger UX cost — more stages means more 20+-block walls-of-cards, not fewer |
| 9 → 30+ block types | The registry pattern genuinely scales — one file, one line, verified | `isGridEligible`'s hardcoded `if (blockType === 'text' \|\| ...)` allowlist does **not** scale — every new scalar-shaped block type needs a matching manual edit to that function, or it defaults to full-width even if it's tiny |
| Mock data → real API | Service-layer swap is clean | Error handling, field-semantic collisions (`execution_lane`/`guardrail_verdict`), and versioning are all currently zero — this is where scale meets the real backend readiness gap (§12) hardest |
| Small data → large data | Blocks that render one card of aggregate data are fine | `TableBlock`/`ItemQueueBlock` have no virtualization or pagination — a 5,000-row API response renders 5,000 DOM nodes with no safeguard |
| For designers/PMs | Manifest JSON is readable but requires understanding `slotName`/`blockType`/`binding` vocabulary — not something a non-engineer edits directly today | Adding a layout hint (§11's recommendation) would need to stay just as readable, or this audience is locked out further |
| For backend engineers | The `{manifest, fixture}` contract is simple to target | The two confirmed field-semantic collisions (§12) mean backend engineers need this audit's §12 table, not just the manifest shape, to wire correctly |
| For frontend engineers | Adding a block type is genuinely easy and well-patterned | Adding *any* layout capability currently means editing `StageRenderer.jsx`'s heuristic by hand, not something declarative |

---

## 20. TESTING AUDIT — what's missing, highest-value first

Existing coverage (verified, real, good): `resolveBinding` (7 cases), `validateManifest` (garbage-input, stageKey, duplicate slotName, unknown blockType), `validateBlockData` for all 13 types including edge cases, every block's empty/error/valid render path, `findNearestStep`.

**Missing, in priority order:**
1. **An end-to-end "no orphaned blocks" test over real data** — loop every manifest in `manifests/*.json` against its matching fixture in `data/raw/`, resolve+validate every block, assert zero results are `undefined`/fail validation. This single test would have caught the exact class of bug in §8 before it reached the shipped manifests, and should be the #1 new test written.
2. **A semantic-unit-consistency check for `barChart`/`waterfallChart` data** — assert every magnitude value in one chart's rows parses to numbers within the same order of magnitude (or share a common unit marker). This is the direct fix-adjacent test for §8.1/§8.2.
3. **`StageRenderer`'s `isGridEligible`/`groupIntoRows` logic** — currently zero direct tests; only exercised incidentally through whatever manual QA happened.
4. **A rendered-DOM test for at least one chart** (currently all block tests call components as bare functions, never through an actual React renderer/jsdom) — this is the only way to catch a Recharts-level runtime exception before a user does, given there's no ErrorBoundary (§14) as a safety net either.
5. **Route-level tests** (`StagePage`/`Shell`/`ActionStoriesHome`) — none exist; the `cancelled`-flag race-condition logic in particular is exactly the kind of thing worth a real test given how easy it is to regress silently.
6. **API-failure-path tests** once a real backend exists — timeout, 404, 500, malformed JSON, empty array.
7. **Visual regression** — reasonable to defer given this is pre-launch, but should exist before the layout/grouping model in §11 changes, to catch unintended reflow across all 105 real screens at once.

---

## 21. SECURITY / TRUST BOUNDARY

- **`dangerouslySetInnerHTML`, `eval`, `new Function`: zero occurrences anywhere in `src/` or `extraction/`** (grep-confirmed). No arbitrary-HTML injection surface exists today.
- **Bindings are safely resolved** — `resolveBinding` is a pure dot-path walker over already-parsed JSON, never a string passed to any interpreter. Confirmed safe by construction, not just by testing.
- **No dynamic code generation** of any kind is used to turn configuration into behavior — the "registry lookup by string key" pattern (`BLOCK_REGISTRY[block.blockType]`) is a safe, bounded map lookup, not a dynamic `import()`/`eval` of backend-controlled code.
- **Can backend-controlled *data* control dangerous behavior?** Not today, because nothing renders raw HTML or executes anything derived from a binding value. **This changes the moment any future feature adds a `visibleIf` expression evaluator (§5, Level 7) or a rich-text/markdown block** — that would be the point to re-run this section of the audit, not before.
- **Are actions validated server-side / are permissions enforced server-side?** **Not applicable today** because there is no server-side mutation at all (§13) — the moment `confirmStage` becomes a real `POST`, this becomes a real open question the frontend cannot answer on its own; the audit's assumption must be "no," until a backend contract proves otherwise.
- **Frontend validation is not authorization** — worth stating explicitly since `validateManifest`/`validateBlockData` could be mistaken for a security boundary: they are data-shape guards for rendering safety, not access control, and were never claimed to be more than that in the code itself.

---

## 22. DOCUMENTATION VS IMPLEMENTATION

| Documentation claim | Actual implementation | Match? | Impact |
|---|---|---|---|
| `INTEGRATION.md`: "`recharts` ... is still unused — `SeriesBlock.jsx` renders chart data as a raw inline `<path>`" | `SeriesBlock.jsx` no longer exists. Five dedicated chart components (`BarChartBlock`, `LineChartBlock`, `ScatterChartBlock`, `WaterfallChartBlock`, `HeatmapGridBlock`) exist, four of them genuinely built on `recharts` | **MISMATCH (doc is stale)** | Low risk (doc is more-cautious than reality), but signals docs are not kept in lockstep with fast-moving code — the same risk applies to anything else in `INTEGRATION.md` not re-verified here |
| A guide I wrote earlier this session: "9 block types," "series is the chart type," "StageRenderer stacks every block full-width" | 13 block types exist today; no manifest uses `"series"`; `StageRenderer` now groups scalars into a grid | **MISMATCH (my own earlier doc is now stale)** | Same lesson: this codebase changes fast enough that any static onboarding doc needs a "verified as of" date and a re-check step, not just a one-time write |
| `manifests/REPORT.md`/`blockTypes.js` header comment: "the smallest set of structural shapes that covers every screen" | `extraction/audit-report.md` (same day) finds **845 open issues**, including 9 confirmed cross-workflow classification inconsistencies for the *same* shape | **PARTIAL MISMATCH** — the vocabulary is well-designed, but "covers every screen" correctly is not yet true in practice | Medium — a reader trusting the comment would not know to check the audit report for known exceptions |
| `StageRenderer.jsx`'s own doc comment: "An unknown blockType, or a binding that resolves to nothing, never crashes the page ... loud during development instead of an invisible gap in production" | True for those two specific failure modes (verified). **Not true for a genuine JS exception inside a block's render** — no `ErrorBoundary` exists anywhere | **PARTIAL MISMATCH** — the claim is narrower than its own phrasing suggests | Medium-High — this is exactly the kind of claim a reviewer would take at face value and be wrong about in production |
| `tailwind.config.js` comment: "Single dark-mode mechanism: the `data-theme=\"dark\"` attribute on `<html>`, written by `useThemeStore.js`'s `paint()`" | `useThemeStore.js` does not exist anywhere in this repository (grep-confirmed) | **MISMATCH** | Low functional risk (dark mode simply never activates) but confirms this config file was copied from the target `realifyai` app, not authored for this scaffold — a real trap for a new engineer who reads the comment and goes looking for a file that isn't there |
| `useActionStoriesStore.js`: "TODO(action-stories-mutations): ... replace `confirmStage` with an async action" | Confirmed still exactly a `TODO`, not implemented | **MATCH** (honest, accurate self-documentation) | None — this is the standard the other stale docs above should be held to |

---

## 23. ROOT CAUSE ANALYSIS OF CURRENT UI PROBLEMS

| Symptom | Root cause classification | Precise cause |
|---|---|---|
| "Some charts look wrong / bars wildly different heights" | **Data-semantics / manifest-generation problem**, not a renderer bug | `extraction/classifyBlocks.js`'s `isBarChartShaped()` checks magnitude-key *presence*, not cross-row *unit compatibility* — confirmed on `S9.1/decide.checks` (ratio+dollars+percent) and `S9.1/decide.totals` (dollars+bare count) |
| "Same kind of data is a chart here but a list there" | **Missing abstraction / classifier non-determinism** | No stable per-concept contract exists; classification is re-derived from raw shape per workflow at generation time — confirmed by the project's own `extraction/audit-report.md` §A.4, 9 groups |
| "A scatter chart looks upside down" | **Component bug (isolated, single-file fix)** | `ScatterChartBlock.jsx` omits the y-negation `LineChartBlock`'s `parseSvgPathPoints` correctly applies for the same class of raw SVG-coordinate source data |
| "Screens feel like a wall of boxes" | **Missing abstraction (layout/section concept), partially mitigated** | No section/grouping model exists in the manifest schema; `StageRenderer`'s new `isGridEligible` heuristic reduces but (per the un-rerun audit) does not eliminate the 61-stage/745-block density problem the project's own tooling quantified |
| "Hard to tell what's fixed vs dynamic" | **Documentation problem, now also partially a real architectural ambiguity** | Prior docs (including one I wrote this session) overstated the system's dynamism; §5 of this report is the corrected, level-by-level answer |
| "Not sure how backend JSON will determine screens" | **Architectural limitation, honestly scoped** | Backend can determine *values* and *which block type per slot*; it cannot determine *layout, page chrome, or actions* without new schema (§11, §20 target architecture) |
| "Some item fields just don't show up" | **Block-schema / missing-abstraction problem, already self-diagnosed** | One-level-deep recursion in `LabelValueListBlock`/`ObjectBlock`/`ItemQueueBlock` — 20 confirmed live instances per `extraction/audit-report.md` §A.3 |
| "Dark mode doesn't work" | **Backend/config contract problem** (missing file referenced by another file's comment) | `tailwind.config.js` names `useThemeStore.js` as the activation mechanism; it does not exist in this repo |
| "Approve button doesn't do anything real" | **Not a bug — an explicitly scoped, documented gap** | `TODO(action-stories-mutations)`, matches its own comment exactly |

---

## 24. P0 / P1 / P2 / P3 FIX LIST

### P0 — must fix before production
1. **Add a React `ErrorBoundary` around each rendered block (or at minimum around `StageRenderer`'s map).** *Why:* one uncaught exception currently white-screens an entire stage; this is the single highest-severity gap relative to the "never crashes" claim the code itself makes. *Files:* new `blocks/BlockErrorBoundary.jsx`, wrap in `StageRenderer.jsx`. *Risk:* very low — additive, no existing behavior changes for the non-error path. *Scope:* all screens.
2. **Fix the confirmed bar-chart unit-scale bug** (`S9.1/decide.checks`→`guardrail_verdict`, `S9.1/decide.totals`, and the 8 other `extraction/audit-report.md` §A.4 groups). *Why:* actively misleading a user comparing bar heights of incompatible units. *Files:* `extraction/classifyBlocks.js` (classifier — add a unit-compatibility check before choosing `barChart`), then regenerate manifests via `npm run generate-manifests`. *Risk:* low, generation-time only, fully re-testable via `npm run audit`/`npm run validate-manifests`. *Scope:* 9+ confirmed workflows.
3. **Fix the scatter Y-axis inversion.** *Why:* every raw-SVG-sourced scatter chart renders upside down relative to its design. *Files:* `blocks/ScatterChartBlock.jsx` — mirror `chartGeometry.js`'s `parseSvgPathPoints` y-negation convention (needs a decision: flip at the geometry-helper layer so both chart types share one convention, not two divergent ones). *Risk:* low, isolated to one file. *Scope:* every workflow with a raw-coordinate scatter block (`S9.1`, `S10.2`, others — grep `blockType.*scatterChart` to enumerate exactly).
4. **Add real network-error/timeout handling to `actionStoriesService.js` before any real API swap** (distinguish 4xx/5xx/offline/malformed, add an `AbortController`, add a retry-once for transient failures). *Why:* today, every failure mode collapses into one indistinguishable red string — unacceptable once real network variance exists. *Files:* `services/actionStoriesService.js` only (confirms the swap is still contained to one file, per its own design intent). *Risk:* low-medium, needs test coverage added alongside. *Scope:* all screens (this is the single choke point every screen goes through).
5. **Resolve the `execution_lane`/`guardrail_verdict` field-semantic collisions documented in `INTEGRATION.md` *before* wiring the real `/v1/proposals` endpoint** — rename/remap per that document's own table. *Why:* wiring as-is will silently show wrong data to a real user, per the project's own analysis. *Files:* the manifests that bind these two slots, plus whatever remapping layer replaces the direct bind. *Risk:* medium — requires backend-shape knowledge, cannot be done frontend-only. *Scope:* every `decide`-adjacent stage that uses these slots (most workflows, per `REPORT.md`'s vocabulary table).

### P1 — should fix immediately after
6. **Add an end-to-end "zero orphaned blocks over real data" test** (loop every manifest+fixture pair, assert nothing falls through to `BlockPlaceholder`). *Why:* would have caught #2 and the 6 remaining A.2 under-classified fields automatically, going forward. *Files:* new test in `extraction/` or `src/features/action-stories/__tests__/`. *Risk:* none (test-only). *Scope:* whole system, ongoing regression protection.
7. **Fix the one-level-deep recursion data loss** in `LabelValueListBlock`/`ObjectBlock`/`ItemQueueBlock` (20 confirmed instances). *Why:* real content silently vanishes today. *Files:* the three block components + their shared `nestedEntryText.js` helper — extend recursion depth or add a generic "expandable nested list" fallback. *Risk:* low-medium (visual change to affected cards, needs a quick visual pass across the 20 named instances). *Scope:* 20 named blocks across ~15 workflows.
8. **Re-run `npm run audit` after today's `isGridEligible` change and reconcile `extraction/audit-report.md`.** *Why:* the report currently on disk predates the fix and is misleading about current density. *Files:* none (tooling run), but update the committed report. *Risk:* none. *Scope:* reporting accuracy only.
9. **Give `severityTone.js` the `rf-status-*` tokens instead of hardcoded Tailwind literals**, closing the two-parallel-status-color-systems gap. *Files:* `blocks/severityTone.js`. *Risk:* low, purely visual, should be pixel-verified against existing usages (currently only exercised by `ItemQueueBlock`). *Scope:* any block rendering severity (currently `ItemQueueBlock` items only).
10. **Add a minimal accessible heading structure** — at least promote each block's card title from `<p>` to a real `<h2>`/`<h3>` scoped correctly under the page's one `<h1>`. *Files:* all 13 block components (mechanical, low-risk change, same visual result via CSS). *Risk:* low. *Scope:* every screen.

### P2 — architectural improvements
11. **Add a declarative layout hint to the manifest schema** (`layout: {span, group}`, defaulting to today's heuristic when absent) — closes the Level-4 dynamism gap without an engine rewrite. *Files:* `manifests/blockTypes.js`/`validateManifest.js` (schema), `StageRenderer.jsx` (consume it, keep fallback), `extraction/generateManifests.js` (optionally start emitting it). *Risk:* medium — schema-additive, backward-compatible if defaulted correctly; needs the fallback path tested against all 105 existing manifests unchanged. *Scope:* whole system, opt-in per block.
12. **Introduce an explicit "section" concept** (a manifest-level grouping above individual blocks) to solve the "wall of cards, no way to tell what belongs together" problem structurally rather than just densifying it. *Files:* schema + `StageRenderer.jsx` + a new `SectionHeader` presentational component. *Risk:* medium, this is the one change in this list closest to "architecture-shaping" — plan it deliberately, don't bolt it onto `StageRenderer` as a 6th responsibility (§18's warning). *Scope:* whole system, worth prototyping on the 3 densest stages first (`S10.6/decide` at 84%, `S9.3/execute` at 81%, `S9.9/execute` at 78%).
13. **Wire the real theming activation path** (`useThemeStore.js` + a toggle) or remove the dark-mode CSS/`dark:` classes if theming is genuinely out of scope. *Why:* authored-but-unreachable code is a maintenance liability either way. *Risk:* low. *Scope:* app-wide, cosmetic.
14. **Recharts overlay composition** — for the confirmed `p10Path`+`netDots` case (and any future pair like it), consider a manifest-level "compose these N chart primitives into one chart" concept rather than accepting permanently-split cards. *Risk:* medium-high (real new capability). *Scope:* narrow today (1 confirmed case), but worth deciding on purpose rather than by accident.

### P3 — nice-to-have
15. Remove the dead `brand`/`danger`/`cb-*` Tailwind config inherited from the target app, or wire it if genuinely needed.
16. Factor the repeated card-shell class string into one shared `<BlockCard>` wrapper component.
17. Add table sort/pagination/virtualization once real row counts justify it (not urgent at today's fixture sizes).
18. Add `AbortController`-based real request cancellation (currently only a `cancelled`-flag no-op-on-stale-response, which is correct but doesn't actually cancel the network request).
19. Remove or actually wire the unused `axios` dependency — it's listed in `package.json` but has zero imports anywhere in `src/`.

---

## 25. TARGET PRODUCTION ARCHITECTURE

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ROUTING            (unchanged — already sound)                            │
├───────────────────────────────────────────────────────────────────────────┤
│ DATA ACCESS        + real HTTP client, timeout/retry/AbortController       │
│                    + explicit error taxonomy (NetworkError/NotFound/      │
│                      SchemaError) instead of one generic Error            │
├───────────────────────────────────────────────────────────────────────────┤
│ SCHEMA / MANIFEST  + optional `layout: {span, group}` per block (P2 #11)  │
│                    + `validateManifest` failures surfaced to the UI,      │
│                      not just console.warn                                │
│                    + a stable per-concept block-type contract (kills the  │
│                      classifier non-determinism in §8, ideally as a       │
│                      lint/CI check over extraction/audit.js's own A.4)   │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYOUT             NEW, thin layer between manifest and render:           │
│                    section grouping (P2 #12) + the existing               │
│                    isGridEligible heuristic demoted to "default when no   │
│                    explicit layout hint is present" — never removed,      │
│                    since it must keep working for every un-migrated       │
│                    manifest                                               │
├───────────────────────────────────────────────────────────────────────────┤
│ BLOCK REGISTRY     (unchanged — already sound, already scales cleanly)    │
├───────────────────────────────────────────────────────────────────────────┤
│ BLOCK COMPONENTS   + ErrorBoundary per block (P0 #1)                      │
│                    + shared <BlockCard> wrapper (P3 #16)                  │
│                    + scatter Y-fix (P0 #3), nested-recursion fix (P1 #7)  │
├───────────────────────────────────────────────────────────────────────────┤
│ DATA BINDING       (unchanged — resolveBinding is already correct)       │
├───────────────────────────────────────────────────────────────────────────┤
│ VALIDATION         (unchanged mechanism — output now surfaced, not        │
│                     swallowed)                                            │
├───────────────────────────────────────────────────────────────────────────┤
│ ACTIONS            NEW, thin layer: manifest-declared actions with a      │
│                    real endpoint, loading/success/failure states, and    │
│                    the existing Zustand store extended (not replaced) to │
│                    track in-flight/failed state per action                │
├───────────────────────────────────────────────────────────────────────────┤
│ STATE              (unchanged pattern — URL-owns-navigation-state is      │
│                     correct and should not change)                        │
├───────────────────────────────────────────────────────────────────────────┤
│ ERROR HANDLING     ErrorBoundary (new) + explicit network-error taxonomy  │
│                    (new) alongside the existing, already-good manifest/   │
│                    binding/validation error path (kept as-is)             │
├───────────────────────────────────────────────────────────────────────────┤
│ DESIGN SYSTEM      rf-* tokens (kept), dead brand/danger/cb-* config      │
│                    removed, dark-mode either wired (useThemeStore) or     │
│                    its CSS removed — no more authored-but-dead surface    │
└───────────────────────────────────────────────────────────────────────────┘
```

**What stays fixed:** routing, the resolve→validate→registry pipeline, the block-registry extension pattern, the URL-owns-navigation-state rule, the `rf-*` token system, the block components' "plain function, no hooks" contract.
**What becomes more declarative:** layout/grouping (via an additive, backward-compatible manifest field), actions (currently zero manifest presence at all), error taxonomy (currently one shape for everything).
**What this deliberately does NOT do:** rewrite the renderer, replace the registry pattern, or invent a general expression/condition language for `visibleIf`-style dynamism (§5 Level 7) — that is a real capability gap, but the security question in §21 says it should be added deliberately and later, not folded into this pass.

---

## 26. EXACT FILES THAT SHOULD CHANGE (P0/P1 scope only)

- `src/features/action-stories/blocks/BlockErrorBoundary.jsx` (new) + `components/StageRenderer.jsx` (P0 #1)
- `extraction/classifyBlocks.js` + regenerate all `manifests/*.json` (P0 #2)
- `src/features/action-stories/blocks/ScatterChartBlock.jsx` + `blocks/chartGeometry.js` (P0 #3)
- `src/services/actionStoriesService.js` (P0 #4)
- Manifests binding `execution_lane`/`guardrail_verdict` (enumerate via `grep -l guardrail_verdict manifests/*.json`) (P0 #5)
- New test file under `src/features/action-stories/` or `extraction/` (P1 #6)
- `blocks/LabelValueListBlock.jsx`, `blocks/ObjectBlock.jsx`, `blocks/ItemQueueBlock.jsx`, `blocks/nestedEntryText.js` (P1 #7)
- `extraction/audit-report.md` (regenerate, P1 #8)
- `blocks/severityTone.js` (P1 #9)
- All 13 files in `blocks/` (heading tag change only, P1 #10)

## 27. WHAT SHOULD NOT BE CHANGED

- The manifest→resolveBinding→validateBlockData→registry pipeline shape — it is sound, tested, and the right pattern.
- The URL-owns-navigation-state rule (`useParams`, no duplicate state in Zustand or components) — correct, explicitly documented, verified.
- The "blocks are plain functions, no hooks" contract — enables the current clean unit-test style; don't compromise it for a shortcut.
- The `rf-*` design token system and the chart color system in `chartPalette.js`/`chart-tokens.css` — both are genuinely well-reasoned and validated against a real methodology.
- The block-registry extension pattern for new block *types* (file + registry line + validator) — already proven to scale (13 types added with zero changes to `StageRenderer.jsx`'s dispatch logic).
- The `extraction/` pipeline's overall shape (mockup → classify → generate → validate → audit) — it is unusually rigorous internal tooling for a project this size; the gap is that its *findings* (audit-report.md) haven't all been acted on yet, not that the tooling itself is wrong.

## 28. TOP 10 RISKS

1. No `ErrorBoundary` — one bug in any block can white-screen a whole stage in front of a real user.
2. Chart classifier non-determinism — actively misleading data visualization already proven in production-bound manifests (not hypothetical; named workflows, named fields).
3. Two documented field-semantic collisions (`execution_lane`, `guardrail_verdict`) that will silently corrupt meaning the moment the real API is wired, per the project's own analysis.
4. Zero network-error handling — the service layer is not ready for a real, unreliable network the moment it stops reading local files.
5. Approve/Start button is entirely decorative — if any stakeholder believes clicking it does something, that's a trust-breaking surprise waiting to happen.
6. Zero accessibility — a real compliance and usability risk the moment this reaches an actual customer base, not just an internal demo.
7. No section/layout declarativeness — every future screen redesign is a `StageRenderer.jsx` heuristic edit, not a config change, undermining the "backend can compose screens" pitch.
8. Silent data loss (one-level-deep recursion) — already quantified at 20 instances by the project's own tooling; a real user cannot know what they're not seeing.
9. Dark mode is fully authored, fully dead — a specific, avoidable maintenance trap (a future engineer will spend real time debugging "why doesn't dark mode turn on" against a `useThemeStore.js` that doesn't exist).
10. Fast-moving code vs. stale docs (proven twice in this very session, including my own earlier guide) — without a "verified as of / re-check before trusting" discipline, onboarding docs will keep drifting from reality as this codebase keeps changing this quickly.

## 29. FINAL "WOULD I APPROVE THIS FOR PRODUCTION?" VERDICT

**No — not in its current state, and not as a full rewrite either.**

This is a well-architected internal rendering engine with genuinely good bones (a real registry pattern, real defensive validation, real tests, honest self-documentation of its own gaps in code comments, and — unusually — its own internal audit tool that already found most of what this external audit independently confirmed). It is not, today, a product a real user should be shown: the chart layer actively misrepresents some data, the one real user action does nothing, there is no safety net against an unknown exception, there is no accessibility, and the backend integration path has two known, unaddressed correctness landmines.

The path to production is the P0/P1 list in §24, not a rewrite: fix the 5 P0 items (roughly 1-2 focused engineering days, mostly isolated single-file changes), then the 5 P1 items (another few days, mostly mechanical), and re-run `extraction/audit.js` to get a fresh, current baseline before the next review. The architecture underneath is worth keeping.
