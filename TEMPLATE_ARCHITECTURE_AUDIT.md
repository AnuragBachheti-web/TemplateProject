# Decision-Driven Template Architecture — Read-Only Audit

**Scope:** `/Volumes/D/TemplateProject` @ `06535d3` (main, 3 uncommitted staged files)
**Mode:** Read-only. No code was modified.
**Method:** Every number below was measured from the repository, not estimated. Measurement commands are named inline so each claim is re-checkable.

---

## 1. Executive summary

The rendering engine is **sound and should be kept almost entirely**. The problem is not the renderer — it is that there is **no template layer at all**, and the runtime payload is a mockup export rather than a business contract.

Five findings decide the plan:

1. **There is no template selection anywhere.** `templateId`, `template_id`, `TEMPLATE_REGISTRY`, `selectTemplate` return **zero matches** across `src/` and `extraction/`. A screen is chosen by URL (`:code/:stageKey`) → file path. Nothing about the data influences which layout renders.

2. **There are no templates, only instances.** 26 manifest files hold 105 stage manifests / 1,719 blocks. Counting distinct blockType signatures per stage: reason **24 distinct / 26 stages**, analyze **25/26**, decide **26/26**, execute **26/26**. Roughly **96% of stage layouts are unique**. `slotName` vocabulary: **835 distinct names**, of which **667 are used exactly once** and only **32 appear in ≥10 stages**.

3. **The engine already supports reuse — the corpus just never exercises it.** `manifests/templateReuse.e2e.test.jsx` renders the unmodified real `S9.11/analyze` manifest against a deliberately divergent second payload (different array lengths, a different object shape, one field absent) and passes. The template mechanism works. Nothing has ever used it as a template.

4. **The seven runtime axes do not exist.** 0 of 7 are present as fields in any of the 105 fixtures (`cardinality` 0, `contract_class` 0, `entitlement` 0, `persona` 0, `on_clock` 0, `lens` 2, `mode` 5). The closest thing to a Mode axis is `execLabel`, present in 105/105 fixtures with **two** distinct values — `"Suggest"` ×104, `"Assist"` ×1. It is a constant, not an axis.

5. **Eligibility currently fails open, twice over.** Of 52 declared actions, **40 carry no `when` gate at all** and are unconditionally enabled. Of the 12 that are gated, the `ne` operator means a backend that simply omits `blocked`/`canApprove` leaves the action enabled. And the gate is evaluated **only in `StageActionBar.handleClick`** — `useActionStoriesStore.runAction` and `dispatchAction` never re-check it, so eligibility lives in the presentation layer rather than at the dispatch boundary.

Supporting facts: every one of the 105 fixtures contains CSS (`var(--` appears **16,239 times**); **3,009** numeric values arrive as pre-formatted display strings; **6 tests currently fail**; there is **no CI**; `httpClient.js` and `proposalFieldMapping.js` are both built, tested, and have **zero importers**.

**Verdict:** this is one architectural addition (a template layer above the existing renderer) plus one contract cleanup (the payload), not a rewrite. The recommended shape is **5 canonical templates**, a **~40-line pure selector**, and a **~25-field Decision Object**. Everything below `StageRenderer` stays as-is.

`template-contract-demo.html` (the file open in the IDE) is an accurate, honest description of the system **as it is today** — manifest-per-stage. It is excellent onboarding material and correctly labels every mock. It does not yet describe the decision-driven target; it should be updated after §15/§16 land rather than treated as the target spec.

---

## 2. Current architecture

### Traced end-to-end: `S9.1 / decide`

```
URL  /action-stories/S9.1/decide
 └─ App.jsx  route ":code/:stageKey"            (react-router-dom 7, BrowserRouter)
     └─ Shell.jsx (TopBar + sidebar + theme)
         └─ StagePage.jsx        useParams() → {code:"S9.1", stageKey:"decide"}
             │  key={`${code}/${stageKey}/${retryToken}`}  → clean remount per stage
             └─ Promise.all([ getWorkflowIndex(), getStageData(code, stageKey) ])
                 └─ actionStoriesService.js
                     ├─ import.meta.glob('/src/.../data/index.json')        → workflow index
                     ├─ import.meta.glob('/src/.../manifests/*.json')       → S9.1.json (array of 4)
                     │    └─ .find(m => m.stageKey === 'decide')            ← THE ONLY "SELECTION"
                     │    └─ validateManifest(manifest) → MALFORMED throw on any problem
                     └─ import.meta.glob('/src/.../data/raw/*/*.json')      → S9.1/decide.json
                 ├─ StageRenderer.jsx  (23 blocks)
                 │    pass 0: blocks.filter(b => b.when === undefined || evaluateCondition(b.when, fixture))
                 │    pass 1: resolveBinding(b.binding, fixture)
                 │            → BLOCK_REGISTRY[b.blockType]
                 │            → validateBlockData(type, value)   → placeholder + console.warn on failure
                 │    layout : composeSections(layoutItems, manifest.sections) → { main[], rail[] }
                 │    pass 2: <BlockErrorBoundary><Component slotName data compact role/></…>
                 │    └─ StageSections.jsx → GridPanel | ComposedPanel | FlowRow | LoneScalarStrip | RailPanel
                 └─ StageActionBar.jsx  (manifest.actions[])
                      resolveActionState(action, fixture)  ← actionEligibility.js, pure
                      → useActionStoriesStore.runAction    ← zustand
                        → dispatchAction                   ← actionStoriesMutations.js
                          → ACTION_HANDLERS[action] ?? genericActionHandler
                            → setTimeout(220ms) → localStorage write.  NO HTTP.
```

### Subsystem inventory

| Concern | File | State |
|---|---|---|
| Entry / routing | `src/main.jsx`, `src/App.jsx`, `src/constants/actionStoriesRoutes.js` | Working. URL is the single source of navigation state; the store deliberately holds no copy. |
| Manifest loading | `src/services/actionStoriesService.js` | `import.meta.glob`, lazy, one retry on transient failure, AbortSignal-aware. No HTTP. |
| Data loading | same file | Same mechanism, `data/raw/<code>/<stageKey>.json`. |
| Binding resolution | `manifests/resolveBinding.js` (30 lines) | Never throws. Dot-path + bracket indices. Returns values byte-identical. |
| Block registry | `blocks/index.js` | 14 blockTypes → 14 components. |
| Shape validation | `manifests/blockTypes.js` | 14 `validate<Type>` functions. `undefined` is never a failure; only present-but-wrong-shaped is. |
| Manifest validation | `manifests/validateManifest.js` | Fail-loud: any problem → `MALFORMED`, no render. |
| Condition language | `manifests/actionCondition.js` | 12 operators + `all`/`any`. No arithmetic, no user code, cannot throw. |
| Action framework | `components/actionEligibility.js` + `StageActionBar.jsx` | Genuinely generic — zero business vocabulary in either file. |
| Layout | `layout/composeSections.js` (pure) + `components/StageSections.jsx` (DOM only) | Clean separation. 4 row treatments. |
| State | `store/useActionStoriesStore.js`, `store/useThemeStore.js` | zustand. Action state keyed `${code}/${stageKey}/${actionId}`. |
| HTTP client | `services/httpClient.js` | axios, 10s timeout, one retry, full error classification. **0 importers.** |
| Error taxonomy | `services/actionStoriesErrors.js` | 8 codes, `userMessage` separated from developer `message`. |
| Field mapping | `services/proposalFieldMapping.js` | Real `guardrail_verdict` enum documented. **0 importers.** |
| Extraction toolchain | `extraction/*.js` | Mockup HTML → fixtures → manifests. 8 npm scripts. |
| Tests | 44 files, 800 tests | **794 pass, 6 fail.** |
| CI | — | **None.** No `.github`. |

---

## 3. Target architecture

```
Decision Object (one backend response)
        │  action_type × stage × cardinality
        ▼
selectTemplate()               ← NEW: ~40 lines, pure, table-driven
        │  template_id
        ▼
TEMPLATE_REGISTRY              ← NEW: 5 canonical template JSON files
        │  a template = the EXISTING manifest schema, minus code/headline
        ▼
seven axes applied via blocks[].when / actions[].when   ← EXISTING mechanism, no new code
        ▼
StageRenderer → resolveBinding → validateBlockData → BLOCK_REGISTRY   ← UNCHANGED
        ▼
composeSections → StageSections                                       ← UNCHANGED
        ▼
StageActionBar → resolveActionState → runAction                       ← UNCHANGED shape,
        ▼                                                                one guard added
dispatchAction → POST /v1/action-stories/:proposal_id/actions          ← NEW backend
        ▼
response returns the new Decision Object → re-render
```

**The single structural change:** `getStageData` stops doing `manifests[code].find(m => m.stageKey === stageKey)` and starts doing `TEMPLATE_REGISTRY[selectTemplate(decision)]`. That is the whole template layer. Everything downstream already works and is already tested.

---

## 4. What is already good and must be reused

Do not rewrite any of this. It is the reason this project is 8 weeks of work and not 6 months.

1. **`resolveBinding.js`** — 30 lines, never throws, no coercion. Exactly right. A template system needs nothing more.
2. **`actionCondition.js`** — the `when` language is already sufficient to express **all seven axes** with no new code (§16). Its deliberate refusal to be a general expression language is a feature.
3. **`blockTypes.js` + `BLOCK_REGISTRY`** — 14 types cover 1,719 blocks across 26 workflows. No evidence a 15th is needed. Validators treat absence as valid and presence-but-wrong as a failure, which is the correct contract posture.
4. **`StageRenderer.jsx`** — the two-pass design (resolve/validate → compose → build nodes) is correct. Compact-ness is a property of a block's neighbours, so it cannot be decided by the block; delegating it to the layout layer is right.
5. **`composeSections.js` / `StageSections.jsx`** — a pure function plus a dumb component. Keep the split.
6. **`actionEligibility.js` + `StageActionBar.jsx`** — genuinely generic. `StageActionBar` contains no action id, no `if (stageKey === 'decide')`, no knowledge of "approve". This is the hardest part of a generic action framework and it is already done.
7. **`actionStoriesErrors.js`** — 8-code taxonomy with `userMessage` separated from the developer message. Ready for a real backend unchanged.
8. **`httpClient.js`** — built, tested, correct retry policy. Wire it; don't rewrite it.
9. **`BlockErrorBoundary`** — per-block isolation. One bad block cannot white-screen a stage.
10. **URL-as-state** — the store deliberately holds no copy of "which workflow is active". Preserve this exactly.
11. **`templateReuse.e2e.test.jsx`** — the one test that proves the template mechanism works. It becomes the pattern for the whole Phase-1 test suite.
12. **The 105 manifests + 105 fixtures as a *corpus*** — not as a runtime artifact. They are the only evidence of what real screens need, and they are the conformance set that proves a canonical template covers its family.

---

## 5. What is actually broken/missing

**Broken (working code that produces a wrong outcome):**
- 6 failing tests. `extraction/classifyBlocks.test.js` (staged, modified) asserts a `RECORD_TABLE_RAW_KEYS` exemption and a "`path` is a business field, not SVG geometry" rule. Neither exists in `extraction/classifyBlocks.js` — `grep` finds zero matches. Tests were written for an implementation that was never landed. Today a business field named `path` (e.g. `{path:"Refurbish and relist", grade:"grade B"}`) classifies as `lineChart`.
- Eligibility is enforced in the click handler, not at dispatch (§9).
- Mockup geometry (`bandLeft`, `dotLeft`, `newLeft`) is **visible to users** in `TableBlock` — `decorativeKeys.js` has no rule for it. Confirmed independently in `template-contract-demo.html` §7.
- `StagePage.jsx` renders `workflow?.name || manifest.name` twice: once as a pill (line 80) and once as the `<h1>` (line 94).

**Missing (does not exist at all):**
- Template selection, template registry, `template_id`.
- The Decision Object.
- All seven axes.
- 5 of 6 operator actions (Approve selected, Modify, Send back, Dismiss with reason, Snooze).
- Every backend endpoint.
- Post-action state refresh.
- CI.
- Density budgets.

---

## 6. Gap count

**24 original audit gaps.** They collapse into **8 engineering workstreams** (§19, §B). Traceability is preserved in both directions.

| ID | Gap | Area | Current state | Required change | Owner | Priority | Major/Minor | Reuse existing code? |
|---|---|---|---|---|---|---|---|---|
| G1 | No template selection layer | FE | `templateId`/`selectTemplate`/registry: 0 matches repo-wide. Selection = `manifests[code].find(m=>m.stageKey===k)` | Pure `selectTemplate(action_type, stage, cardinality)` + frozen lookup table | FE | P0 | Major | Yes — plugs into `getStageData`, nothing downstream changes |
| G2 | 105 story-specific manifests, ~96% unique layouts | FE | 26 files / 105 stages / 1,719 blocks; distinct signatures 24,25,26,26 of 26 | 5 canonical templates; manifests demoted to reference corpus | FE | P0 | Major | Yes — template = existing manifest schema |
| G3 | slotName vocabulary sprawl | FE | 835 distinct names, 667 single-use, 32 used ≥10× (18 `foot*`, 68 `label*`, 39 `note*`; `footStatus` 39 + `footerStatus` 22 = same concept) | Canonical ~60-name slot vocabulary bound to Decision Object paths | FE + Product | P0 | Major | Yes — pure rename inside templates |
| G4 | No Decision Object contract | Shared | Envelope is `{code,stageKey,name,headline,props,state,data}`; `data` is a mockup dump | Define ~25-field canonical contract (§13) | Shared | P0 | Major | Partly — `resolveBinding` reads it unchanged |
| G5 | Seven axes absent | Shared | 0/7 present. `cardinality` 0/105, `contract_class` 0, `entitlement` 0, `persona` 0, `on_clock` 0, `lens` 2, `mode` 5 | Backend emits all 7; frontend reads via existing `when` | Shared | P0 | Major | **Yes — `actionCondition.js` needs zero changes** |
| G6 | Mode axis degenerate | Shared | `execLabel` in 105/105 with 2 values: `"Suggest"`×104, `"Assist"`×1 | Replace with real `mode` enum on the Decision Object | BE | P1 | Minor | Yes |
| G7 | CSS in the business payload | Shared | `var(--` ×16,239 across 105/105 files; `tone` 104, `bg` 105, `hue` 73, `tint` 67, `color-mix` 94; `execSegs` 105/105 | Backend sends business values only; severity as enum if needed | BE | P0 | Major | Yes — `deltaTone.js` already derives tone client-side |
| G8 | Geometry in the business payload | Shared | `height` 105/105, `h` 13, `x` 8, `cx` 8, `cy` 7, `w` 6, `top` 1; `bandLeft`/`dotLeft`/`newLeft` **render visibly in TableBlock** | Remove from contract; charts get typed series | BE | P0 | Major | Yes |
| G9 | SVG path data in the payload | Shared | 7 fixtures carry `"path"`, 4 with `M…L…` commands | Send `{x,y}` series; `lineChart` derives geometry | BE | P1 | Minor | Partly — `LineChartBlock` needs a series branch |
| G10 | Pre-formatted numbers only | Shared | 3,009 `"$…"`/`"…%"` string values (`"$7.90"` ×29, `"88%"` ×32) | Send typed numbers + unit/currency; format client-side | Shared | P1 | Major | Blocks already accept both — additive |
| G11 | UI-visibility booleans in the payload | Shared | `approveShow` 8, `blockShow` 9, `zoneMeta` 2, `restNote` 1, `slateMeta` 7, `liveStats` 2, `footerStatus` 22 | Drop; visibility is `blocks[].when` over business facts | Shared | P1 | Minor | Yes — `when` already exists |
| G12 | Dead envelope fields | Shared | `props` (`$preview` w/h) and `state` read by no component | Drop from the contract | BE | P2 | Minor | Yes |
| G13 | Only one action type exists | FE + BE | 52 actions, **all** `{id:"confirm",kind:"primary",action:"confirm"}`. 0 declare `reason`, 0 declare `loadingLabel`. Approve-selected / Modify / Send back / Dismiss / Snooze absent | 6 action types in templates + 6 backend operations | FE + BE | P0 | Major | **Yes — schema, dialog, `reason` capture, `minLength` all implemented and tested, never exercised** |
| G14 | 40 of 52 actions ungated | FE | `buildActionsForStage` emits no `when` when neither `guardrail_blocked` nor `guardrail_can_approve` survived classification | Every action carries an explicit eligibility condition | FE | P0 | Major | Yes — `when` mechanism unchanged |
| G15 | Eligibility enforced only in the click handler | FE | Gate lives in `StageActionBar.handleClick`; `runAction` and `dispatchAction` never re-check | Re-evaluate at the dispatch boundary; reject ineligible | FE | P0 | Major | Yes — one guard in `runAction` |
| G16 | Fail-open by construction | Shared | `ne` passes on `undefined`; omitting `blocked`/`canApprove` enables the action | `eligibility.<action>.allowed` required; missing ⇒ disabled | Shared | P0 | Major | Yes — `exists` operator already supports fail-closed |
| G17 | No backend | BE | Zero endpoints. `httpClient.js` built/tested, **0 importers**. Data via `import.meta.glob`; actions via `localStorage` | 3 endpoints (§17) | BE | P0 | Major | Yes — `httpClient` is the swap point |
| G18 | No post-action state refresh | FE + BE | A completed action flips local UI state only; nothing re-fetches | Action response returns the new Decision Object | Shared | P0 | Major | Partly |
| G19 | Completion persisted to localStorage | FE | `rf-action-stories-completed-actions`, per browser | Server-owned status; localStorage becomes a cache at most | Shared | P1 | Major | Yes — store shape survives |
| G20 | Guardrail enum vs boolean unresolved | Shared | `proposalFieldMapping.js` documents `within_limits`/`beyond_limits`/`not_applicable`/`undetermined`; UI reads booleans. **0 importers** | Decision Object settles it once | Shared | P1 | Major | Yes |
| G21 | 6 failing tests, no CI | Test | `extraction/classifyBlocks.test.js` asserts `RECORD_TABLE_RAW_KEYS` + a `path`-is-business rule that don't exist. No `.github` | Land or revert the rule; add CI | FE | P0 | Minor | Yes |
| G22 | No tests for selector/axes/actions/guardrails/API/status | Test | 800 tests cover today's engine well; none cover anything in §3 | Test suites per workstream | FE | P0 | Major | Yes — `templateReuse.e2e.test.jsx` is the pattern |
| G23 | Header duplication; nothing pinned | FE | `workflow.name` rendered at `StagePage.jsx:80` and `:94`. No sticky header; action bar sits at flow end | One identity line; pin header + action bar | FE | P1 | Minor | Yes |
| G24 | No density budgets | FE | decide mean 20.2 blocks (max 35), execute 21.4 (max 32), live 35, analyze 14.0 (max 30) | Per-template budget, test-enforced | FE | P1 | Minor | Yes |

---

## 7. Frontend gaps

- **G1, G2, G3** — the template layer. New: `templates/selectTemplate.js`, `templates/templateRegistry.js`, 5 template JSON files, `templates/slotVocabulary.js`. `StageRenderer` and below unchanged.
- **G13, G14** — actions. Templates declare 6 actions with `kind`, `confirm`, `reason`, `when`. `StageActionBar` needs **one** change: multi-select support for Approve-selected (a `selection` value threaded into the action payload). Everything else is already built.
- **G15** — one guard in `useActionStoriesStore.runAction`.
- **G21, G22, G23, G24** — tests, CI, chrome, budgets.
- **G9, G10** — `LineChartBlock` gains a typed-series branch; a shared `formatValue(value, unit, currency)` helper.

## 8. Backend gaps

- **G17** — three endpoints (§17). None exist.
- **G4, G5, G6** — emit the Decision Object with all seven axes and a real `mode` enum.
- **G7, G8, G9, G11, G12** — stop emitting CSS, geometry, SVG paths, UI-visibility booleans, and `props`/`state`.
- **G16** — emit `eligibility` per action type with an explicit `allowed` boolean and a `blocked_reason`.
- **G18** — the action response returns the new Decision Object.
- **G19** — server-owned status and an audit trail.
- **Authorization** — must be enforced on the action endpoint. `when` is a UI affordance, never a security boundary. `template-contract-demo.html` §8 already states this correctly.

## 9. Shared contract gaps

- **G4** Decision Object (§13).
- **G5** seven-axis vocabulary and enum values.
- **G10** number typing: `{value: number, unit: "USD"|"pct"|"count", precision?: number}` vs pre-formatted strings.
- **G16** eligibility shape and fail-closed semantics.
- **G18** action response shape: full new Decision Object, or an ack plus a re-fetch. **Recommendation: return the full object** — it eliminates a round-trip and a whole class of stale-read races.
- **G20** guardrail representation: the 4-value enum wins; `blocked`/`canApprove` become derived frontend values.
- **G13** the action-type enum and the status transitions each one causes (§18).

## 10. Testing gaps

**Current:** 44 files, 800 tests, 794 pass, **6 fail**, no CI.

What exists and is good: binding resolution, all 14 validators, manifest validation, condition language, action eligibility, layout composition, every block component, `manifestFixtureSweep` (data-level, 105 stages), `renderSweep` (render-level, 105 stages — staged, new), `templateReuse.e2e` (the one real template proof), `routeLevel` and `s911Decide` E2E.

**Missing, in priority order:**
1. `selectTemplate` — exhaustive table coverage, every `action_type × stage × cardinality` combination, plus unmapped-input behaviour.
2. Template conformance — each of the 5 templates rendered against **every** fixture in its family (this is what the 105-fixture corpus is *for*).
3. Seven axes — one test per axis proving it changes slots/behaviour, and one proving it does **not** create a new page.
4. **Fail-closed guardrails** — the highest-value security test. Missing `eligibility` ⇒ action disabled. Ineligible action dispatched directly through `runAction` ⇒ rejected.
5. Each of the 6 operator actions: dialog → reason validation → dispatch → status transition.
6. API contract tests against `httpClient` (success, 4xx, 5xx, timeout, abort, malformed).
7. Status lifecycle — every transition in §18, and every illegal one rejected.
8. Density budget assertions per template.
9. **CI** — `npm run lint && npm test` on every PR. Nothing else is safe without this.

---

## 11. Mock/fixture migration plan

**Do not delete anything.** The 105 fixtures are the only evidence of what real screens need.

- **Phase 0 — freeze.** Move `data/raw/**` to `src/features/action-stories/__corpus__/fixtures/`. Not loaded at runtime; loaded by tests only. One commit, no behaviour change.
- **Phase 1 — derive.** For each of the 5 template families, extract the union of business fields its member fixtures use. That union *is* the Decision Object's per-family payload section. This is mechanical and scriptable.
- **Phase 2 — clean.** Produce one cleaned fixture per family: CSS stripped, geometry stripped, numbers typed, seven axes added, `eligibility` added. ~5 files replace 105 at runtime. They become the dev/demo payloads until the API exists.
- **Phase 3 — conform.** Keep all 105 originals as the conformance set. A canonical template must render every member of its family without producing a placeholder. This is the test that proves consolidation didn't lose content.
- **Phase 4 — retire.** Once the API is live, the 5 cleaned fixtures become `msw`/test doubles. The 105 originals stay in `__corpus__` permanently as design evidence.

**Field disposition:**

| Field | Count | Disposition |
|---|---|---|
| `bg`, `tone`, `tint`, `hue`, `edge`, `srcTint`, `var(--…)` | 16,239 occurrences, 105/105 files | **Remove from contract.** Already ignored by the renderer (`decorativeKeys.js`); tone is derived client-side by `deltaTone.js`. Removal is invisible to users. |
| `execSegs` | 105/105 | **Remove.** Pure decorative segment colours. |
| `execLabel` | 105/105, 2 values | **Replace** with the `mode` axis (G6). |
| `height`, `h`, `x`, `y`, `cx`, `cy`, `top`, `w` | up to 105/105 | **Remove.** Charts receive typed series; geometry is computed by `chartGeometry.js`. |
| `bandLeft`, `dotLeft`, `newLeft` | — | **Remove urgently** — unfiltered by `decorativeKeys.js` and **visible to users** in `TableBlock`. Add a filter rule as an interim guard. |
| `__raw` | — | **Remove.** Extraction internal. |
| `path` (SVG) | 7 files | **Replace** with `{x,y}` series. Note the classifier currently misreads a *business* field named `path` as chart geometry (G21). |
| pre-formatted numbers | 3,009 | **Keep temporarily, type in parallel.** Blocks accept both, so adding typed fields is non-breaking. Switch templates over per family. |
| `approveShow`, `blockShow` | 8, 9 | **Remove.** Visibility belongs in `blocks[].when` over business facts. |
| `zoneMeta` 2, `restNote` 1, `slateMeta` 7, `liveStats` 2, `footerStatus` 22, `footStatus` 39 | — | **Consolidate.** `footStatus`/`footerStatus` are one concept under two names — the clearest instance of G3. Single-use fields (`restNote`) are presentation copy; fold into narrative. |
| `checks` 21, `blocked` 21, `canApprove` 12, `blockReason` 8, `ctaLabel` 12 | — | **Promote to first-class Decision Object fields** under `eligibility` and `guardrails`. These are the only genuinely business-critical fields in the current payload. |
| `props`, `state` | 105/105 | **Remove.** Read by nothing. |

---

## 12. Manifest migration plan

**Never a 1:1 manifest→template mapping.** 105 manifests must become 5 templates, not 105 templates.

1. **Cluster.** Group the 105 stage manifests by `(stage, dominant block shape)`. Stage already gives 4 natural clusters; `decide` splits by cardinality (all 26 decide fixtures contain a ≥3-item object array, so all 26 are slate-shaped today — single-item Decide is a Phase-2 need, not a Phase-1 one).
2. **Intersect.** For each cluster, compute the slot intersection (present in ≥80% of members) → the template's **core slots**. Slots in 20–80% → **conditional slots** with a `when`. Slots below 20% → drop or fold into narrative.
3. **Author.** Write 5 template JSON files by hand, using the existing manifest schema minus `code`/`headline`/`name`. Reviewed, not generated.
4. **Verify.** Render each template against all 105 corpus fixtures in its family. Zero placeholders is the bar. Whatever fails names a real missing slot.
5. **Cut over.** `getStageData` switches from file lookup to `selectTemplate`. One file changes.
6. **Archive.** Move `manifests/S*.json` to `__corpus__/manifests/`. Keep `manifests/*.js` (the engine) exactly where it is.
7. **Retire the generator.** `extraction/generateManifests.js` stops being a build step and becomes analysis tooling. Do **not** delete `extraction/` — `classifyBlocks.js` and `parseMockup.js` are the record of how the corpus was derived.

**Classification:**

| Class | Count | Evidence | Action |
|---|---|---|---|
| True reusable templates | **0** | No manifest is used by more than one stage | Must be created |
| Story-specific instances | **105** | 96% unique blockType signatures | Demote to corpus |
| Duplicated layouts | **~4** | Only 2 reason-stage and 1 analyze-stage signature collisions across 26 | Merge into their family template |
| Mock-specific bindings | **most of 838** | 667 of 835 slotNames used exactly once | Collapse into ~60 canonical slots |
| Presentation-only fields | see §11 | 16,239 CSS occurrences + geometry | Remove from contract |
| Business fields | ~15 | `checks`, `blocked`, `canApprove`, `blockReason`, `ctaLabel`, `totals`, `rows`, `policy`, … | Promote to Decision Object |
| Should become Decision Object fields | ~25 | §13 | Promote |

---

## 13. Decision Object proposal

Minimum viable canonical runtime contract. **~25 fields.** Deliberately smaller than the field list in the brief — every field below is one the frontend demonstrably needs; anything that only *might* be needed is listed under "not in the contract" with a reason.

```jsonc
{
  // ── identity (required, backend-owned) ───────────────────────────
  "proposal_id":   "prop_01J8X…",   // stable; keys actions, status, audit
  "story_code":    "S9.1",          // workflow/category identity
  "stage":         "decide",        // reason | analyze | decide | execute | live

  // ── selection triple (required) — the ONLY inputs to selectTemplate ─
  "action_type":   "reprice",       // enum, backend-owned
  "cardinality":   "many",          // "one" | "many"   ← axis 1

  // ── the six remaining axes (required; may be null where N/A) ──────
  "contract_class": "standard",     // axis 2
  "on_clock":       true,           // axis 3 (clock)
  "deadline":       "2026-09-18T17:00:00Z",  // required when on_clock
  "mode":           "suggest",      // axis 4 — suggest | assist | auto
  "entitlement":    "full",         // axis 5 — full | limited | locked
  "lens":           "margin",       // axis 6
  "persona":        "merchandiser", // axis 7

  // ── presentation-neutral identity (required) ─────────────────────
  "title":     "Quarterly assortment review",
  "narrative": "214 active SKUs; 12 below GMROI target for two quarters.",

  // ── decision economics (optional; omit rather than send null) ─────
  "impact":     { "value": 18400, "unit": "USD" },
  "confidence": { "value": 0.88, "calibrated": true },

  // ── eligibility (REQUIRED — fail-closed, see §16/§18) ─────────────
  "eligibility": {
    "approve":          { "allowed": true },
    "approve_selected": { "allowed": true },
    "modify":           { "allowed": false, "blocked_reason": "Price floor override requires Director approval." },
    "send_back":        { "allowed": true },
    "dismiss":          { "allowed": true },
    "snooze":           { "allowed": true }
  },

  // ── guardrails (optional) ────────────────────────────────────────
  "guardrails": {
    "verdict": "within_limits",     // within_limits | beyond_limits | not_applicable | undetermined
    "checks":  [ { "label": "Capital ceiling", "status": "pass", "detail": "$468K of $520K" } ]
  },

  // ── the decision payload (required; shape varies BY TEMPLATE) ────
  "proposal": { /* slate items, comparison rows, bridge steps — see per-template shape */ },
  "totals":   { /* roll-up metrics */ },

  // ── execute-stage only (optional) ────────────────────────────────
  "execution": { "progress_pct": 0, "steps": [], "verification": {}, "rollback": {}, "ledger": [] },

  // ── lifecycle (required, backend-owned) ──────────────────────────
  "status":     "pending",          // §18
  "updated_at": "2026-09-15T09:12:00Z"
}
```

**Required (17):** `proposal_id`, `story_code`, `stage`, `action_type`, `cardinality`, `contract_class`, `on_clock`, `mode`, `entitlement`, `lens`, `persona`, `title`, `narrative`, `eligibility`, `proposal`, `status`, `updated_at`.

**Optional (7):** `deadline` (required iff `on_clock`), `impact`, `confidence`, `guardrails`, `totals`, `execution`, `brand`/`channel`/`category` as a single optional `context` object.

**Derived frontend values (never sent):** `template_id` (from the selection triple), `blocked`/`canApprove` (from `eligibility`), every colour and tone (`deltaTone.js`), every chart coordinate (`chartGeometry.js`), all display formatting, `compact`, `span`, `region`, section membership, relative time from `deadline`.

**Backend-owned:** everything in the object. The frontend never writes a Decision Object field.

**Fields that should NOT exist in the contract:**

| Field | Why not |
|---|---|
| `bg`, `tone`, `tint`, `hue`, `edge`, any `var(--…)` | Target principle 8. Already ignored by the renderer. |
| `x`, `y`, `cx`, `cy`, `top`, `height`, `bandLeft`, `dotLeft`, `newLeft` | Geometry is a frontend computation. |
| SVG `path` strings | Same. Send typed series. |
| `approveShow`, `blockShow` | Visibility is `when` over business facts, not a backend UI flag. |
| `execSegs`, `execLabel` | Decorative; superseded by `mode`. |
| `props`, `state`, `__raw` | Mockup-export artifacts. Read by nothing. |
| `ctaLabel` as free text | Derivable from `action_type` + `cardinality` + counts. Keeping it means shipping button copy through the business API. Retain **only** `blocked_reason`, which is a genuine backend explanation. |
| `blocked`, `canApprove` | Superseded by `eligibility.*.allowed`, which is explicit and fail-closed. |
| `calibrated` as a top-level field | It qualifies `confidence`; nest it. |
| `agent` | No frontend consumer identified. Add when a screen needs it. |

---

## 14. Canonical template proposal

**Five Phase-1 templates.** A template is the existing manifest schema minus `code`/`name`/`headline`.

| Template | `template_id` | Covers | Core slots | Actions |
|---|---|---|---|---|
| Reason | `reason.v1` | 26 reason stages (mean 9.1 blocks) | `narrative`, `policy`, `inputs`, `roles`, `trigger` | none |
| Analyze-Compare | `analyze.compare.v1` | 26 analyze stages (mean 14.0, max 30) | `primaryInsight`, `comparison`, `distribution`, `detail_rows` | none |
| Decide-Slate | `decide.slate.v1` | all 26 decide stages — **every one** has a ≥3-item object array | `recommendation`, `slate`, `guardrails`, `totals`, `basis` | approve, approve_selected, modify, send_back, dismiss, snooze |
| Execute-Bridge | `execute.bridge.v1` | 26 execute stages (mean 21.4, max 32) | `plan`, `progress`, `verification`, `rollback`, `ledger` | approve (arm/start), send_back, dismiss |
| Locked/Teaser | `locked.v1` | any stage where `entitlement === "locked"`; `locked` slot already appears 19× in the corpus | `title`, `teaser_summary`, `upgrade_cta` | none |

**Recommended build order and why:**

1. **Decide-Slate first.** It is where the business value is (operator actions, guardrails, eligibility), where the security gaps are (G14/G15/G16), and where cardinality actually matters. All 26 decide stages are slate-shaped, so one template retires 26 manifests immediately. It is also the hardest, and building it first means the selector and Decision Object are validated against the worst case rather than the easiest.
2. **Reason second.** Smallest (mean 9.1 blocks), no actions, lowest risk. Proves the selector and the slot vocabulary on a clean case and gives a fast second data point on template consolidation.
3. **Analyze-Compare third.** Higher variance (max 30 blocks) and the widest slot spread; benefits from the vocabulary being settled by the first two.
4. **Execute-Bridge fourth.** Depends on §18's status lifecycle being real, which depends on the backend.
5. **Locked/Teaser last.** Trivial once the `entitlement` axis exists — roughly a day's work.

**Phase-2 candidates — all DEFER.** Analyze-Trend, Analyze-Bridge, Analyze-Distribution, Decide-Single, Decide-Cards, Execute-Assist, Exception, Decide-Portfolio. **None has evidence in the current corpus.** Decide-Single in particular has *zero* supporting data — all 26 decide fixtures are multi-item. Building a `cardinality: "one"` template now would be speculative. Build the selector so a 6th template is one table row plus one file, then wait for a real proposal that needs it.

---

## 15. Template selector design

Deterministic, pure, ~40 lines, no framework.

```js
// templates/selectTemplate.js
const TEMPLATE_TABLE = Object.freeze({
  // `${action_type}|${stage}|${cardinality}`  →  template_id
  '*|reason|*':            'reason.v1',
  '*|analyze|*':           'analyze.compare.v1',
  '*|decide|many':         'decide.slate.v1',
  '*|execute|*':           'execute.bridge.v1',
});

export function selectTemplate({ action_type, stage, cardinality, entitlement }) {
  if (entitlement === 'locked') return 'locked.v1';   // entitlement short-circuits — a locked
                                                      // proposal never reveals its real template
  return (
    TEMPLATE_TABLE[`${action_type}|${stage}|${cardinality}`] ??
    TEMPLATE_TABLE[`*|${stage}|${cardinality}`] ??
    TEMPLATE_TABLE[`*|${stage}|*`] ??
    null                                              // ← null, never a guess
  );
}
```

**Design decisions, and what was deliberately rejected:**

- **Table, not logic.** Adding an `action_type` that needs its own layout is one table row. No conditional grows.
- **Three-level wildcard fallback, then `null`.** Specific → stage+cardinality → stage → nothing. A `null` renders an explicit "unsupported decision type" state and logs. **It never falls back to a default template**, because silently rendering the wrong layout for an unrecognised decision is worse than rendering nothing.
- **`entitlement` short-circuits before the table.** A locked proposal must not leak its real template's structure.
- **Rejected: a general rules engine / priority scoring / a registry DSL.** The selector has 4 rows today and maybe 12 at Phase 2. A frozen object with `??` chaining is the correct amount of machinery.
- **Rejected: making the selector async or backend-served.** Template selection must be synchronous and deterministic, or it cannot be unit-tested exhaustively.
- **Rejected: `template_id` on the Decision Object.** That would let the backend choose a frontend layout, violating principle 7. The backend sends facts; the frontend selects.

`templateRegistry.js` is the trivial counterpart: `{ 'reason.v1': reasonTemplate, … }`, mirroring `BLOCK_REGISTRY` exactly. Same pattern, same mental model.

---

## 16. Seven-axis design

**The most important finding in this section: the existing `when` mechanism handles all seven axes with zero new code.** `actionCondition.js` already supports `eq`/`ne`/`in`/`notIn`/`gt`/`gte`/`lt`/`lte`/`exists`/`notExists`/`truthy`/`falsy` plus recursive `all`/`any`, over any dot-path. That is a complete axis-evaluation engine. **Do not build a second one.**

| Axis | Present today | Changes UI today | Backend data required | Frontend behaviour it controls | Existing `when` sufficient? |
|---|---|---|---|---|---|
| **Cardinality** | No (0/105) | No | `cardinality: "one"\|"many"` | **Template selection input.** Also toggles per-row selection controls and the Approve-selected action | Selection: no (selector input). Slots: **yes** |
| **Contract class** | No (0/105) | No | `contract_class` enum | Which guardrail/policy slots appear; which actions are offered | **Yes** |
| **Clock** | No (`on_clock` 0; `deadline` 3/105) | No | `on_clock: bool`, `deadline: ISO` | Deadline badge slot; urgency emphasis; snooze availability | **Yes** |
| **Mode** | Degenerate (`execLabel`, 2 values) | No | `mode: suggest\|assist\|auto` | Whether execute-stage actions are armed; whether approval is required at all | **Yes** |
| **Entitlement** | No (0/105) | No | `entitlement: full\|limited\|locked` | **Short-circuits template selection** to `locked.v1`; gates actions when `limited` | Selection: no. Gating: **yes** |
| **Lens** | 2/105, incidental | No | `lens` enum | Which metric/comparison slots are emphasised | **Yes** |
| **Persona** | No (0/105) | No | `persona` enum | Which detail slots and which actions are visible | **Yes** |

**Rules:**
1. An axis may **add, remove, or reorder slots** inside a template, and may **enable or disable actions**. It may never select a different template — except `entitlement: "locked"` and `cardinality`, which are explicit selector inputs, not slot-level modifiers.
2. Axis conditions live in template JSON (`blocks[].when`, `actions[].when`), never in component code.
3. Every axis is **required** on the Decision Object. A missing axis is a contract violation, not a default. This is what stops axes from silently becoming optional and then meaningless — exactly how `mode` degenerated to 104×`"Suggest"`.
4. Axes are read at the same path depth as everything else, so `resolveBinding` needs no change: `{ "path": "entitlement", "op": "eq", "value": "limited" }`.

**Over-engineering warning:** resist building an `AxisProvider`, an axis-resolution service, or per-axis React context. Seven enum fields on one object, read by a predicate language that already exists, is the whole design.

---

## 17. API changes

Three endpoints. None exists. `httpClient.js` is the swap point and needs no changes.

**1 · Queue**
```
GET /v1/proposals?stage=decide&persona=merchandiser&limit=25
→ 200 { items: [DecisionObjectSummary], next_cursor: string|null }
```
Summary = `proposal_id`, `story_code`, `title`, `impact`, `confidence`, `stage`, `on_clock`, `deadline`, `status`. Enough to render a queue without fetching each proposal.

**2 · One decision**
```
GET /v1/proposals/:proposal_id
→ 200 DecisionObject        (§13)
→ 404 { code: "NOT_FOUND" }
```
Replaces `getStageData`'s fixture read. `getStageData` becomes: one HTTP call + a local `selectTemplate` + a local registry lookup.

**3 · Run an action**
```
POST /v1/proposals/:proposal_id/actions
{
  "action_type": "approve_selected",
  "reason":      "…",                       // required for dismiss / send_back / modify
  "selection":   ["item_1", "item_4"],      // required for approve_selected
  "snooze_until": "2026-09-16T09:00:00Z",   // required for snooze
  "idempotency_key": "uuid"
}
→ 200 DecisionObject                        ← the NEW state, not an ack (closes G18)
→ 409 { code: "CONFLICT", userMessage: "…" }         // status changed underneath
→ 403 { code: "CLIENT_ERROR", userMessage: "…" }     // server-side authorization
→ 422 { code: "CLIENT_ERROR", userMessage: "…" }     // ineligible
```

**Non-negotiables:**
- **Authorization is enforced here, server-side.** `eligibility` and `when` are UI affordances. A 403 must be the real gate.
- **`idempotency_key` is required.** Without it a retried POST can double-approve. This is the single most important field in the action contract.
- **The response is the new Decision Object.** An ack-plus-refetch design adds a round-trip and a stale-read window for no benefit.
- Error bodies carry a machine-readable `code` from the existing 8-code taxonomy and an optional `userMessage`. Raw backend messages are never rendered.
- Every request carries an `AbortSignal`. Cancellation is not an error.

**Explicitly NOT recommended (defer):** server-side pagination of arrays inside a Decision Object (`TableBlock` paginates client-side past 12 rows and that is sufficient today); WebSocket/SSE live updates; a manifest-serving endpoint (templates stay frontend-owned — they are layout, and layout is principle 7's frontend concern); a bulk-action endpoint.

---

## 18. Status/action lifecycle

```
                 ┌──────────── snooze ────────────┐
                 ▼                                │
draft ──▶ pending ──▶ approved ──▶ executing ──▶ completed
            │  ▲          │                         │
            │  │          └──▶ failed ──▶ rolled_back
            │  └── send_back ◀──┐
            │                   │
            ├──▶ dismissed      │
            └──▶ modified ──────┘
```

| Action | Precondition | Status transition | Reason | Frontend today | Backend today |
|---|---|---|---|---|---|
| **Approve** | `eligibility.approve.allowed` | `pending → approved` | optional | `{id:"confirm"}` ×52, confirm dialog works | none |
| **Approve selected** | `.allowed` ∧ `cardinality==="many"` ∧ selection non-empty | `pending → approved` (partial) | optional | **missing** — needs row selection + `selection` in payload. `Checkbox.jsx` exists | none |
| **Modify** | `.allowed` | `pending → modified → pending` | **required** | **missing** — needs an edit surface. `SliderBlock` + `Modal` exist | none |
| **Send back** | `.allowed` | `pending → pending` (reassigned) | **required** | **missing** — schema + dialog + `minLength` already implemented, never declared | none |
| **Dismiss with reason** | `.allowed` | `pending → dismissed` (terminal) | **required** | **missing** — `kind:"destructive"` supported, unused | none |
| **Snooze** | `.allowed` ∧ `on_clock` | `pending → pending` (`snooze_until` set) | optional | **missing** — needs a datetime control | none |

**What is genuinely reusable:** the entire action framework. `resolveActionState` already returns `confirmRequired`/`reasonEnabled`/`reasonRequired`/`reasonMinLength`/`actionType`; `StageActionBar` already renders confirm dialogs, reason textareas with `minLength` validation, per-action pending/done/error, retry, and cross-action disabling; `ACTION_HANDLERS` already dispatches by operation type. **Five of the six actions need only template JSON and a backend handler.** Only Approve-selected (row selection) and Snooze (datetime picker) need new frontend UI.

**Fail-closed change (G15/G16):** `useActionStoriesStore.runAction` must re-evaluate `resolveActionState` against the current Decision Object before dispatching and reject if not `allowed`. Today the only gate is `StageActionBar.handleClick`, which is presentation. There is no live bypass path — `runAction` has exactly one caller — but eligibility belongs at the dispatch boundary, not at a click handler, and the server must enforce it independently regardless.

---

## 19. Over-engineering reduction plan

This is the section that keeps the project shippable.

### KEEP — do not touch

`resolveBinding.js` · `actionCondition.js` · `blockTypes.js` (all 14 validators) · `BLOCK_REGISTRY` + all 14 block components · `BlockErrorBoundary` · `StageRenderer.jsx`'s two-pass pipeline · `StageSections.jsx` · `actionEligibility.js` · `StageActionBar.jsx` (one addition for selection) · `actionStoriesErrors.js` · `httpClient.js` · `ui/*` primitives · the zustand store shape · URL-as-state · `validateManifest.js` (it validates templates unchanged).

### SIMPLIFY

| Thing | Now | To | Why |
|---|---|---|---|
| Runtime manifests | 105 files | 5 templates | The entire point of the work |
| Slot vocabulary | 835 names, 667 single-use | ~60 canonical | 667 one-off names is not a vocabulary |
| `composeSections` row types | 4 (`single`, `grid`, `flow`, `explicit`) | Keep all 4 **for now** | Templates declare layout explicitly, so the `flow` heuristic may become dead. Measure after the 5 templates exist; do not pre-emptively delete. |
| Hero-slot heuristics | `HERO_SLOT_NAMES`, `HERO_COMPANION_KEYS`, `isGeneralizedHeroCompanion` in `classifyBlocks.js` | Delete once templates declare `role: "hero"` explicitly | Heuristics exist only because generation had to guess. Templates don't guess. |
| `extraction/generateManifests.js` | A build step | Analysis tooling | Templates are hand-authored and reviewed |
| `decorativeKeys.js` | Defensive stripping | Keep as defence-in-depth | Cheap, and protects against a backend regression. **Add a `bandLeft`/`dotLeft`/`newLeft` rule now** — that leak is user-visible today. |

### REMOVE

- `props` and `state` from the runtime envelope — read by nothing.
- `execSegs`, `execLabel` from the contract.
- All CSS, geometry, and `__raw` from the contract.
- `approveShow` / `blockShow` — replaced by `when`.
- The duplicate `workflow.name` render at `StagePage.jsx:80`.
- Nothing else. In particular: **do not delete the 105 manifests or 105 fixtures** — archive them to `__corpus__`.

### DEFER

All 8 Phase-2 templates (no corpus evidence — Decide-Single has *zero*) · server-side pagination · optimistic mutation queue · next-item flow · WebSocket/SSE · backend-served manifests · a manifest authoring UI · per-persona theming · `proposalFieldMapping.js` wiring (the Decision Object's `guardrails.verdict` supersedes it; keep the file as the enum record).

### Abstractions to refuse outright

| Tempting | Refuse because |
|---|---|
| An axis-resolution service / `AxisProvider` / per-axis context | `actionCondition.js` already does this. Seven enum fields + an existing predicate language. |
| A template inheritance / composition system | 5 templates. Duplication across 5 hand-authored files is cheaper than an inheritance graph. |
| A rules engine for template selection | 4 table rows today, ~12 at Phase 2. A frozen object with `??` chaining. |
| A generic form/edit framework for Modify | One action needs it. Build the specific edit surface. |
| A 15th block type | 14 types cover 1,719 blocks across 26 workflows. No evidence of a gap. |
| A second state store, or duplicating Decision Object state into zustand | The Decision Object is server state. Fetch it, render it, re-fetch after mutation. Do not mirror it. |
| Replacing zustand with Redux/RTK Query | zustand holds ~4 keys. The store is not a problem. |
| A manifest/template versioning + migration framework | Version in the `template_id` string (`decide.slate.v1`). That is sufficient until there is a v2. |

---

## 20. Recommended implementation sequence

**W-0 · Stabilise (2 days, blocks everything).** Fix the 6 failing tests — either land `RECORD_TABLE_RAW_KEYS` + the `path`-is-business rule in `classifyBlocks.js`, or revert the staged test additions. Add CI (`lint && test` on PR). Add the `bandLeft`/`dotLeft`/`newLeft` filter to `decorativeKeys.js` to stop the visible leak. *(G21, part of G8)*

**W-1 · Shared contract (1 week, parallel FE/BE, blocks W-2/W-4/W-6).** Write the Decision Object schema and the seven-axis enums as a reviewed document plus a JSON Schema. Agree the eligibility shape, the number-typing rule, the action-type enum, and the status transitions. Produce one cleaned example Decision Object per template family from the corpus. **No code.** *(G4, G5, G6, G10, G16, G20)*

**W-2 · Template layer (2 weeks, FE).** `selectTemplate.js` + `templateRegistry.js` + `decide.slate.v1` + `reason.v1`. Archive manifests/fixtures to `__corpus__`. Switch `getStageData` to the selector. Conformance tests against all 52 decide+reason corpus fixtures. *(G1, G2, G3, part of G22)*

**W-3 · Fail-closed eligibility (3 days, FE — can run inside W-2).** Every template action carries an explicit `when` over `eligibility.<action>.allowed` using `exists`+`eq` (fail-closed, not `ne`). Add the `runAction` dispatch guard. Tests for missing-eligibility and direct-dispatch-of-ineligible. *(G14, G15, G16)*

**W-4 · Operator actions (1.5 weeks, FE + BE).** Declare all six in `decide.slate.v1`. Build the two genuinely new UI pieces: row selection for Approve-selected, datetime for Snooze. Backend implements six operations with idempotency. *(G13, G18)*

**W-5 · Live API (2 weeks, BE-led).** Three endpoints. Wire `httpClient` into `actionStoriesService` and `actionStoriesMutations`. Action response returns the new Decision Object; re-render from it. Demote localStorage to a cache or drop it. *(G17, G18, G19)*

**W-6 · Payload hygiene (1 week, BE).** The real API emits clean business values only: no CSS, no geometry, no SVG paths, no visibility booleans, no `props`/`state`; typed numbers alongside display strings. *(G7, G8, G9, G11, G12)*

**W-7 · Remaining templates (1.5 weeks, FE).** `analyze.compare.v1`, `execute.bridge.v1`, `locked.v1`. Conformance against the remaining 53 corpus fixtures. *(G2 completion)*

**W-8 · Chrome and density (3 days, FE).** Pin the header and action bar; remove the duplicate name render; enforce per-template density budgets in tests. *(G23, G24)*

Critical path: **W-0 → W-1 → W-2 → W-3 → W-4 → W-5**. W-6, W-7, W-8 parallelise. Roughly **8–9 weeks** with 2 frontend and 1 backend engineer.

---

## 21. Dependencies/blockers

| # | Blocker | Blocks | Resolution |
|---|---|---|---|
| 1 | **No backend exists.** Zero endpoints; `httpClient` has 0 importers | W-5, and the honest completion of W-4 | Backend team must own W-1 jointly. Frontend can complete W-0→W-4 against cleaned fixtures. |
| 2 | **`action_type` vocabulary is undefined.** 0/105 fixtures carry it, yet it is a selector input | W-1, W-2 | Product must enumerate it before W-2 starts. This is the single highest-risk unknown. |
| 3 | **Guardrail representation unresolved.** Real enum (4 values) vs UI booleans; `proposalFieldMapping.js` documents it but is unwired | W-1, W-3 | Decide in W-1. Recommendation: the enum wins; booleans become derived. |
| 4 | **Number formatting undecided.** 3,009 pre-formatted strings vs typed values | W-1, W-6 | Decide in W-1. Recommendation: send typed + unit, format client-side. Blocks already accept both, so this is non-breaking. |
| 5 | **Template ownership undecided.** Frontend-committed vs API-served | W-2 | Recommendation: frontend-owned. Templates are layout; layout is a frontend concern (principle 7). Revisit only if workflows must change without a deploy. |
| 6 | **6 failing tests + no CI** | Everything | W-0, first. |
| 7 | **Cardinality has no negative evidence.** All 26 decide fixtures are multi-item | Decide-Single (Phase 2) | Do not build `cardinality: "one"` speculatively. Wait for a real proposal. |

---

## 22. Definition of done

**Per workstream:**
- **W-0** — `npm test` green (800/800), CI runs on every PR, no user-visible geometry columns.
- **W-1** — Decision Object schema reviewed and signed off by FE, BE, and Product; one valid example per template family; every field traced to a consumer or removed.
- **W-2** — `selectTemplate` is pure, synchronous, and exhaustively unit-tested including unmapped inputs; ≤5 template files under `templates/`; all 105 manifests archived to `__corpus__` and none loaded at runtime; every decide and reason corpus fixture renders through its canonical template with **zero placeholders**.
- **W-3** — every template action carries an explicit eligibility condition; a Decision Object with no `eligibility` disables every action; `runAction` rejects an ineligible dispatch; both cases are tested.
- **W-4** — all six operator actions dispatch with correct payloads, reason validation, and status transitions; idempotency keys sent.
- **W-5** — zero `import.meta.glob` calls in the runtime path; every fetch and mutation goes through `httpClient`; a completed action re-renders from the returned Decision Object; 403/409/422 each render a correct, safe `userMessage`.
- **W-6** — a production response contains no `var(--`, no geometry key, no SVG path, no `props`/`state`, no `__raw`; asserted by a contract test.
- **W-7** — all 105 corpus fixtures render through 5 templates with zero placeholders.
- **W-8** — header and action bar pinned; workflow name rendered once; every template within its density budget.

**Global:** no `templateId` decided by the backend · no business vocabulary in any renderer file · no CSS, coordinate, or SVG path in any payload · `lint` and `test` green · `template-contract-demo.html` regenerated to describe the decision-driven architecture rather than the manifest-per-stage one.

---

## 23. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **5 templates cannot cover 105 screens without losing content.** 96% of layouts are currently unique | Medium | High | The 105-fixture conformance set is the early-warning system. Run it from day one of W-2. If a family genuinely needs 2 templates, take 2 — the failure mode to avoid is 105, not 6. |
| 2 | **`action_type` arrives late or churns.** It is a selector input and 0/105 fixtures carry it | **High** | High | Blocker #2. Freeze it in W-1. The wildcard fallback means a late-arriving `action_type` degrades to stage-level selection rather than breaking. |
| 3 | **Template count creeps back up under delivery pressure.** "Just one more for S9.16" | **High** | High | Adding a template requires a written justification naming which corpus fixtures the existing one fails on. Cap at 8 through Phase 1. |
| 4 | **The backend ships the mockup payload.** 16,239 CSS occurrences is a strong existing habit | Medium | High | Contract test in CI asserting absence of `var(--`, geometry keys, and SVG paths. Fail the build. |
| 5 | **Fail-closed breaks working screens.** 40 of 52 actions are unconditional today; requiring `eligibility` disables all of them until the backend sends it | **High** | Medium | Ship W-3 behind a flag defaulting to fail-open, flip after W-5 confirms the backend populates `eligibility`. **Do not ship fail-closed before the data exists** — it would disable every action in production. |
| 6 | **The renderer accumulates business vocabulary.** It has none today; that is hard-won | Medium | High | A lint rule or test asserting that no file under `components/`, `blocks/`, or `layout/` contains an action or domain name. |
| 7 | **The 105 fixtures are deleted rather than archived**, destroying the only evidence of what real screens need | Low | High | W-2's first commit is the archive move, reviewed separately. |
| 8 | **`bandLeft`/geometry leak persists into production** — it is user-visible today | Medium | Medium | Fixed in W-0, permanently prevented by risk #4's contract test. |
| 9 | **Seven axes become optional in practice**, exactly as `mode` degenerated to 104×`"Suggest"` | Medium | Medium | All seven required on the Decision Object; a missing axis is a contract violation, validated on response. |
| 10 | **No idempotency ⇒ double-approval** on a retried POST | Medium | **Critical** | `idempotency_key` required by the endpoint contract, not optional. |

---

# Summary counts

### A. Original audit gaps — **24**
G1–G24 (§6). Distribution: 11 frontend-originating, 6 backend-originating, 7 shared-contract.

### B. Practical engineering workstreams — **8**

| Workstream | Original gaps | Effort |
|---|---|---|
| W-0 Stabilise (tests + CI + leak fix) | G21, G8(part) | 2d |
| W-1 Shared contract definition | G4, G5, G6, G10, G16, G20 | 1w |
| W-2 Canonical template layer + selector | G1, G2, G3, G22(part) | 2w |
| W-3 Fail-closed eligibility | G14, G15, G16 | 3d |
| W-4 Operator action set | G13, G18 | 1.5w |
| W-5 Live API integration | G17, G18, G19 | 2w |
| W-6 Payload hygiene | G7, G8, G9, G11, G12 | 1w |
| W-7 + W-8 Remaining templates, chrome, density | G2(completion), G23, G24 | 2w |

*(§10's testing gaps are deliberately distributed into the workstream that produces the code under test, rather than counted as a separate workstream. A test workstream detached from its feature does not get written.)*

### C. Frontend implementation count — **11 units**
1. `templates/selectTemplate.js` (new, ~40 lines)
2. `templates/templateRegistry.js` (new, ~20 lines)
3. 5 template JSON files (new, hand-authored)
4. `templates/slotVocabulary.js` — canonical ~60 slot names (new)
5. `actionStoriesService.js` — selector swap + `httpClient` wiring (modify)
6. `actionStoriesMutations.js` — real POST + idempotency (modify)
7. `useActionStoriesStore.js` — dispatch-boundary eligibility guard (modify, ~10 lines)
8. `StageActionBar.jsx` — row selection for Approve-selected (modify)
9. Snooze datetime control (new, small)
10. `StagePage.jsx` — pinned header, deduplicated name (modify)
11. `formatValue()` + `LineChartBlock` typed-series branch (new helper + modify)

**Zero new block types. Zero renderer changes. Zero layout-engine changes.**

### D. Backend implementation count — **9 units**
1. `GET /v1/proposals` (queue)
2. `GET /v1/proposals/:id` (Decision Object)
3. `POST /v1/proposals/:id/actions` (with idempotency)
4. Decision Object serializer (~25 fields)
5. Seven-axis derivation
6. `eligibility` computation per action type
7. Six action operations + status transitions
8. Server-side authorization on the action endpoint
9. Payload hygiene — strip CSS, geometry, SVG, `props`/`state`; emit typed numbers

### E. Shared contract count — **7 artifacts**
1. Decision Object schema (~25 fields) + JSON Schema
2. Seven-axis enum vocabularies
3. `action_type` enum *(blocker #2 — highest risk)*
4. Eligibility shape + fail-closed semantics
5. Number typing rule (typed value + unit/currency)
6. Status lifecycle + legal transitions
7. Error contract (reuses the existing 8-code taxonomy unchanged)

### F. Testing count — **9 suites**
1. `selectTemplate` — exhaustive table + unmapped-input coverage
2. Template conformance — 5 templates × 105 corpus fixtures, zero placeholders
3. Seven axes — each changes slots/behaviour; none creates a new page
4. **Fail-closed guardrails** — missing eligibility disables; direct dispatch rejected *(highest value)*
5. Six operator actions — dialog → reason → dispatch → transition
6. API contract — success, 403, 404, 409, 422, 5xx, timeout, abort, malformed
7. Status lifecycle — every legal transition, every illegal one rejected
8. Payload hygiene contract test — no `var(--`, no geometry, no SVG paths
9. Density budgets per template

Plus: fix the 6 failing tests, and add CI (`lint && test` on PR).

### G. What can be removed/simplified
- 105 runtime manifests → 5 templates (**archive, never delete**)
- 835 slotNames → ~60
- 105 runtime fixtures → 5 cleaned dev payloads (originals → `__corpus__`)
- 16,239 CSS occurrences → 0 in the contract
- 3,009 pre-formatted numbers → typed values
- `props`, `state`, `__raw`, `execSegs`, `approveShow`, `blockShow` → gone
- `bandLeft`/`dotLeft`/`newLeft` → gone (**user-visible today — fix in W-0**)
- Hero-slot heuristics in `classifyBlocks.js` → gone once templates declare `role` explicitly
- `generateManifests.js` → analysis tooling, not a build step
- Duplicate `workflow.name` render at `StagePage.jsx:80`
- localStorage action persistence → server-owned status

### H. What should NOT be changed
- `resolveBinding.js` — correct as written
- `actionCondition.js` — **already the seven-axis engine; do not build a second one**
- `blockTypes.js` and all 14 validators
- `BLOCK_REGISTRY` and all 14 block components
- `BlockErrorBoundary` and per-block error isolation
- `StageRenderer.jsx`'s two-pass pipeline
- `composeSections.js` / `StageSections.jsx` — keep the pure/dumb split
- `actionEligibility.js` — pure, no business vocabulary
- `StageActionBar.jsx`'s generic design (one additive change only)
- `actionStoriesErrors.js` — the 8-code taxonomy
- `httpClient.js` — wire it, don't rewrite it
- `ui/*` primitives
- The zustand store's key shape `${code}/${stageKey}/${actionId}`
- **URL-as-state** — the store deliberately holds no navigation copy
- The `extraction/` toolchain — the record of how the corpus was derived
- The 105 manifests and fixtures **as a corpus** — the conformance set and the only evidence of what real screens need

---

*Audit complete. No code was modified.*
