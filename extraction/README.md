# extraction/

One-shot tooling that turns the `.dc.html` mockup exports in `source-mockups/` into clean JSON
fixtures under `src/features/action-stories/data/`. Not part of the shipped app — run it once
(or whenever the mockup exports change), then the app reads the generated JSON.

## Run

```sh
npm run extract
# or: node extraction/extract.js
```

Optional overrides (used for smoke-testing without touching real output):

```sh
node extraction/extract.js <sourceDir> <dataOutDir>
```

## Output

- `src/features/action-stories/data/raw/<code>/<stageKey>.json` — one file per real stage:
  `{ code, stageKey, name, props, state, data }`, where `data` is that screen's own
  `renderVals()` output and `state` is its raw `state = {...}` class field.
- `src/features/action-stories/data/index.json` — `[{ code, name, stages: [stageKey, ...] }, ...]`
  across every workflow found.
- A console run report: files seen, extracted vs. skipped vs. failed, and any warnings
  (e.g. a stage-number/stage-name mismatch in a filename, or a workflow whose breadcrumb name
  isn't identical across all its stages). One bad file never stops the run.

## File format background

- Filenames: `<code>-<stageNum>-<stageName>[-<suffix>].dc.html`, e.g. `S9.11-1-reason.dc.html`,
  `S10.6-3-decide.dc.html`. Stage numbers: 1=reason, 2=analyze, 3=decide, 4=execute (S10.6 also
  has 5=live).
- Skipped, not story data: `S00-*.dc.html` (shared shell), `Canvas.dc.html` (empty), and the two
  duplicate S9.2 exports (`S9.2-1-reason-standalone.dc.html`, `Realify S9.2 Reason -
  Replenishment.html`) — `S9.2-1-reason.dc.html` is the canonical one.
- Each real file has one `<script type="text/x-dc" data-dc-script data-props="...">` block
  containing `class Component extends DCLogic { state = {...}; renderVals() { return {...} } }`.
  `extraction/dcLogicSandbox.js` runs that class for real in a Node `vm` context (a stub
  `DCLogic` supplies `this.props`; the subclass's own `state = {...}` field supplies
  `this.state`) — not regex-scraped — so computed values (e.g. a `spark()` helper turning numbers
  into an SVG path) come out the same as the mockup itself would render.
- `data-props` on the script tag documents each prop as either a bare default or a descriptor
  like `{"type":"enum","options":[...],"default":"Suggest"}`; either way the screen's own code
  expects the plain default value, so `parseMockup.js` flattens descriptors down to `.default`
  before constructing `Component`.
- The screen's name comes only from its own visible breadcrumb, `>NAME · CODE<` — never inferred
  from a shell/nav file, since two different shells in this export map codes to names
  inconsistently.
