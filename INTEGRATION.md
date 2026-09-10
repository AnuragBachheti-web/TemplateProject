# Integrating Action Stories into realifyai

What changes, file by file, when this project folds into `apps/realifyai`. Nothing here has been
applied to this repo — it's the checklist for whoever does the merge.

## 1. Move the feature folder

```
src/features/action-stories/  →  apps/realifyai/src/features/workspace/modules/action-stories/
```

A sibling of the existing `modules/simulation/` and `modules/dashboard-view/` — same shape
(`components/`, `pages/`, its own data), same `@/features/workspace/modules/action-stories/...`
import path once it lands. `src/features/action-stories/manifests/{validateManifest,
resolveBinding, blockTypes}.js` move with it unchanged; `src/features/action-stories/blocks/`
and its 7 components move unchanged too.

`extraction/` does **not** move — it's build-time tooling (Part 1/2's mockup→fixture pipeline),
never imported by the shipped app. It can stay in this scaffold repo, or move to
`apps/realifyai/scripts/` if the team wants to keep regenerating manifests from updated mockups;
either way it's not part of the runtime bundle.

`src/constants/actionStoriesRoutes.js` and `src/store/useActionStoriesStore.js` move to
`apps/realifyai/src/constants/` and `apps/realifyai/src/store/` respectively (matching where
`workspaceRoutes.js` and the app's other Zustand stores already live) — not into the module
folder itself, since realifyai keeps routing and store definitions centralized rather than
per-feature.

## 2. Register routes

**`apps/realifyai/src/constants/routes.js`** — add two entries near the other `/decisions/*`
children (screaming-snake-case key, string path, matching every existing entry):

```js
ACTION_STORIES:        "/decisions/action-stories",
ACTION_STORIES_STAGE:  "/decisions/action-stories/:code/:stageKey",
```

Nested under `/decisions` (`ROUTES.DECISIONS`) rather than standing alone at `/action-stories` —
this is a judgment call, not something this scaffold's own spec dictated. Action Stories reads
like a Workspace surface (it sits beside Simulation and Dashboard View), so it was nested the same
way; a top-level route is just as valid if the team prefers, in which case skip the `child(...)`
step below and add it directly to the top-level `routes` array instead.

**`apps/realifyai/src/routes/routeConfig.jsx`** — one lazy import, one entry, exactly like
`SimulationPage`/`DashboardViewPage` (`routeConfig.jsx:44-45`, `:110`):

```js
const ActionStoriesShell = lazy(() => import('@/features/workspace/modules/action-stories/components/Shell'));
```

```js
// Inside workspaceRoute.children, alongside WORKSPACE_SIMULATE / WORKSPACE_ROLLBACK:
{
  path: child(ROUTES.ACTION_STORIES),
  element: <ActionStoriesShell />,
  children: [
    { index: true, element: <ActionStoriesHome /> },
    { path: ':code/:stageKey', element: <StagePage /> },
  ],
},
```

`Shell` already renders `<Outlet />` internally (see `components/Shell.jsx`) exactly the way
`WorkspacePage` does for its own `:domainSegment` children — the index/`:code/:stageKey` split
is Action Stories' own internal routing, not something routeConfig.jsx needs to know the details
of. `ActionStoriesHome`/`StagePage` get their own lazy imports the same way, from
`@/features/workspace/modules/action-stories/pages/...`.

`Shell.jsx` and `StepTracker.jsx` currently import `actionStoryPath`/`isActionStoriesPath` from
`@/constants/actionStoriesRoutes` — that file's `ACTION_STORIES_ROOT` constant should be re-pointed
at `ROUTES.ACTION_STORIES` once it moves (mirroring exactly how `workspaceRoutes.js` derives its
own paths from `ROUTES.DECISIONS` rather than hardcoding `/decisions`).

## 3. Swap the service body

`actionStoriesService.js`'s two functions are already written to be a drop-in swap — nothing that
calls `getWorkflowIndex()`/`getStageData()` should need to change. The whole edit is inside this
one file:

```js
// before (current, SAMPLE DATA):
export async function getWorkflowIndex() {
  const load = indexLoaders[INDEX_PATH];
  if (!load) throw new Error(...);
  const mod = await load();
  return mod.default;
}

// after:
import httpClient from '@/services/httpClient';

export async function getWorkflowIndex() {
  return httpClient.get('/action-stories').then((res) => res.data);
}

export async function getStageData(code, stageKey) {
  return httpClient
    .get(`/action-stories/${code}/${stageKey}`)
    .then((res) => res.data); // must already be { manifest, fixture } — see below
}
```

This assumes a `GET /v1/action-stories/:code/:stageKey` that returns `{ manifest, fixture }` in
the same shape `getStageData` returns today. If the real backend instead serves the manifest and
the underlying data from two separate endpoints, `getStageData` becomes a `Promise.all` of two
`httpClient.get(...)` calls composed into that same `{ manifest, fixture }` shape — still entirely
inside this one file. Either way, drop the two `import.meta.glob(...)` calls and the
`validateManifest` sanity-check can stay (it's cheap, and it's exactly as useful against a real
API response as it is against a local fixture).

## 4. What's confirmed vs. still a guess

Part 2's `manifests/REPORT.md` already documents, in detail, which vocabulary fields
(`action_type`, `lens`, `severity`, `state`, `target`, `current_value`, `proposed_value`,
`currency`, `impact_minor`, `confidence`, `guardrail_verdict`, `execution_lane`, `source`,
`rationale`, `created_at`) genuinely appear in the 105 mockup fixtures versus which were guessed,
best-effort, or outright false friends. That reasoning was checked **against the mockups only** —
while writing this file, I read the actual realifyai source (`fromProposal.js`,
`workspace/data/proposalSignals.js`, `data/proposalVocabulary.js`, `services/proposalsService.js`)
to see what `GET /v1/proposals` really returns, and two of those Part 2 mappings turn out to be
**wrong in a way worth flagging loudly**, not just "unconfirmed":

| Field | What the real proposal actually has | What our manifests currently map to it | Verdict |
|---|---|---|---|
| `execution_lane` | Server-derived from `guardrail_verdict`; `"agent"` only when the verdict is `within_limits` (`proposalVocabulary.js:130`, `:188`) — governs **who/what executes** | `data.execLabel`, values `"Suggest"` / `"Assist"` — an editable mockup prop controlling **how the screen displays itself** | **Name collision, not a match.** Same slot name, unrelated real-world concept. Rename the slot (e.g. to `displayMode`) before this ships, or it will silently show the wrong thing once real data replaces the fixture. |
| `guardrail_verdict` | A real server enum: `within_limits` \| `beyond_limits` \| `not_applicable` \| `undetermined` (`proposalVocabulary.js:129`) | `data.checks` (a governance checklist) or `blocked`/`canApprove`/`blockReason`/`approveShow` (booleans + strings) | **Different shape entirely**, not just different values. This needs real mapping logic once the endpoint exists — a checklist and a four-value enum don't translate 1:1. Decide whether the checklist becomes a *rendering* of the real verdict (e.g. "beyond_limits" → show `checks` as the reasons) or gets replaced outright. |
| `severity` | A real enum, confirmed via `ActionsQueueList.jsx`'s `TONE` map keys: `crit` \| `act` \| `opp` \| `watch` | Present in only 3 mockup workflows (`S10.3`, `S10.5`, `S9.19`), values `"medium"`/`"high"`/`"low"`/`"critical"`/`"blocking"` | Confirmed real field, but the enum values need an explicit mapping table (e.g. `critical`→`crit`, `blocking`→`crit`) — don't pass these strings through as-is. |
| `target` (`{ref}`) | Confirmed real shape: `proposal.target.ref` (`proposalSignals.js:80`) | Inconsistent per-item identifier keys (`sku`/`id`/`caseId`/`ref`) inside action-queue arrays | The mockups' own `ref` occurrences (`S10.1/analyze.timeline`, `S10.1/execute.spawned`) are the closest match; the rest need per-workflow renaming to land on `target.ref`. |
| `rationale` | Confirmed real: `proposal.rationale`, a single string with a trailing `[RULE-ID]` tag stripped before display (`proposalVocabulary.js:305-306`) | Best-effort screen-level string (`pinnedSub`/`floorNote`/etc., first-present-wins) or `S9.16/reason.rationale` / `S9.20/decide.sampled[].rationale` (genuine literal matches) | Conceptually close; the real field is one sentence per proposal, closer to the mockups' per-item `rationale` occurrences than to the longer screen-level summary text most workflows fell back to. |
| `current_value` / `proposed_value` / `impact_minor` / `currency` | All confirmed real, and confirmed **numeric/typed** (`impact_minor` is literally minor units — `fromProposal.js`'s comment: "paise" — `proposalSignals.js:90` divides it back out for display) | **Nowhere** — every fixture only has pre-formatted display strings (`"$4,120 recoverable"`) | Unchanged from Part 2's finding: this cannot be extracted from the mockups at all. These four fields only become real once the endpoint is live; nothing to "double check" here so much as "build for the first time." |
| `confidence` | Confirmed real: stored `0–1` on the record (`fromProposal.js:63-65`) | Formatted percentage strings (`"88% ± 5"`) in a few workflows; a pure false friend (evidence-citation text) in `S10.1/analyze.classifier` | Confirmed gap, as Part 2 found — plus now confirmed the real shape is exactly the clean float Part 2 guessed it should be, once real data exists. |
| `state` | Confirmed real: the approval state machine — `proposed`, `approved`, `cosign_pending`, `executed`, `rejected`, `expired`, `canceled` (`proposalsService.js`'s own JSDoc) | Per-item `status` strings (`"staged"`, `"applied"`, `"needs signature"`) — a UI/workflow status, not the approval state machine | **Different state machine entirely.** These are believable execution-tracking labels for a mockup, but they are not the 7 real values — don't wire them through as `state` without a real mapping (or accept they'll need their own field once the real data model is understood). |
| `source` | Confirmed real, simple passthrough (`fromProposal.js:118`) | `S10.1/analyze.timeline[].source` (genuine — `"ours"`/`"amazon"`/`"carrier"`/`"realify"`) vs. `S9.11/analyze`'s same-named field meaning something unrelated (a pricing-test methodology) | The `S10.1` shape is closer to right; still needs confirming against real values once `/v1/proposals` is live — "ours"/"amazon" reads plausible but wasn't checked against a real response. |
| `created_at` | Confirmed real | Absent everywhere in the 105 fixtures | Nothing to reconcile — just missing, and will exist once real data is used. |
| `action_type` | Confirmed real, drives `actionTypeLabel()` (a controlled vocabulary: `flag_unprofitable`, `reprice`, `restock`, `pause_ad`, …) | Free-text per-item `tag`/`type`/`classification` (`"fit cluster"`, `"listing diff"`, `"durable trend"`) | Confirmed gap — the real field is a fixed, small enum; the mockups invented free descriptive text per workflow. These are not the same kind of value and won't map cleanly; expect this to need real backend values, not a rename. |
| `lens` | Confirmed real, drives `lensCategory()` | `S10.6/live.lensTiles[].lens` (clean values: "Sales"/"Margin") and `S10.6/analyze.desks[].lens` (compound string) — narrow but genuine | Closest of all the fields to a real, ready-to-use match — worth checking `lensCategory()`'s expected value set against what the mockups actually used. |

**Net effect on the manifests:** don't treat any `execution_lane` or `guardrail_verdict` slot in
`manifests/*.json` as ready to bind against the real API without a rename/reshape — those two are
now *known* to collide with a differently-shaped real field, not just "unconfirmed." Every other
row above was already flagged as a guess in Part 2's `REPORT.md`; this table adds what the real
schema actually is, so the remapping work has a concrete target instead of another guess.

## 5. Deliberately not done here

Per the original brief: no auth, no ledger/mutation wiring beyond the existing
`TODO(action-stories-mutations)` in `useActionStoriesStore.js`, and no dependency beyond what
Part 1 pinned (`react`/`react-dom` ^19.2.4, `react-router-dom` ^7.14.0, `zustand` ^5.0.12, `axios`
^1.17.0, `recharts` ^2.15.4, plus the devDependencies already in `package.json`). `recharts` in
particular is still unused — `SeriesBlock.jsx` renders chart data as a raw inline `<path>` or a
plain value list rather than a real chart; wiring it up to `recharts` was out of scope for this
pass and is a reasonable next step once the merge lands.
