// Runs one screen's real `class Component extends DCLogic { ... }` block in a Node vm sandbox,
// instead of regex-scraping the numbers/labels back out of the source text. The class is the
// mockup's actual logic (including any helpers it defines, e.g. a spark() chart-path builder),
// so this is the only way to get the same values the mockup itself renders.

import vm from 'node:vm'

/**
 * Stub base class every screen's `Component` extends. It only needs to do what DCLogic actually
 * provides to a screen: expose the props the screen was configured with (`this.props`) before
 * any of the subclass's own field initializers run. `this.state` is never set here — it comes
 * for free from the subclass's own `state = {...}` class field, which JS runs immediately after
 * this constructor returns.
 */
function buildDCLogic() {
  return class DCLogic {
    constructor(props) {
      this.props = props || {}
    }
  }
}

/**
 * Some screens build a decorated value (a colored status badge, an arrow glyph) by calling a
 * bare global `React.createElement(...)` from a helper method, expecting the mockup's own runtime
 * to provide `React`. There's no rendering here, so this only needs to capture the same data a
 * real React element carries — {type, props} (React drops the element down to exactly that, plus
 * a non-JSON-serializable $$typeof symbol this stub skips) — as a plain, JSON-friendly object.
 */
function buildReactStub() {
  function createElement(type, config, ...children) {
    const props = Object.assign({}, config)
    if (children.length === 1) {
      props.children = children[0]
    } else if (children.length > 1) {
      props.children = children
    }
    return { type, props }
  }
  return { createElement, Fragment: 'React.Fragment' }
}

/**
 * A handful of screens build a displayed value by calling the React stub above directly (a
 * colored status badge, a title stacked over a SKU) instead of returning a plain string. Left
 * as-is, that shape — `{ type, props: { children, ... } }` — leaks into data/raw/*.json and every
 * downstream classifier/renderer either has to special-case it or silently drops it (this is what
 * broke S9.1/analyze's `rows.product`/`rows.role`/`rows.gmroi` — see extraction/audit.js's A.1
 * check). The sandbox still needs the real stub above so a screen's own renderVals() logic runs
 * without crashing; this just flattens the *result* back down to plain text (same rule as
 * src/features/action-stories/blocks/flattenDisplayValue.js, duplicated here on purpose —
 * generation-only tooling never imports the runtime block components) before it's ever written to
 * disk, so nothing downstream has to know this shape ever existed.
 */
function isJsxStubNode(v) {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof v.type === 'string' &&
    v.props !== null &&
    typeof v.props === 'object' &&
    !Array.isArray(v.props) &&
    'children' in v.props
  )
}

function flattenJsxStub(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(flattenJsxStub).filter(Boolean).join(' ')
  if (isJsxStubNode(value)) return flattenJsxStub(value.props.children)
  return ''
}

/** Recurses through the whole renderVals() result, flattening any JSX-stub node it finds anywhere
 * (top-level field, or nested inside an array/object) down to plain text. Everything else passes
 * through unchanged. */
function deepFlattenJsxNodes(value) {
  if (isJsxStubNode(value)) return flattenJsxStub(value)
  if (Array.isArray(value)) return value.map(deepFlattenJsxNodes)
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = deepFlattenJsxNodes(v)
    return out
  }
  return value
}

/**
 * @param {string} scriptBody - the raw text between <script data-dc-script ...> and </script>.
 * @param {object} propsDefaults - flattened {propName: defaultValue} to construct Component with.
 * @param {Array<{stateKey,min,max,step}>} [controls] - interactive controls found in this same
 *   screen's TEMPLATE markup by parseMockup.js's extractControlElements — used here only to decide
 *   which state keys are worth multi-sampling (see below); never fabricated, always the caller's
 *   own structural finding from the real markup.
 * @param {number} [timeoutMs]
 * @returns {{ state: object, data: object, rawCandidates: object, controlSamples: Array }}
 *   `data` is the screen's renderVals() output at its real initial state (unchanged contract).
 *   `rawCandidates` is every zero-arg instance method's return value, keyed by its own method name,
 *   for every method that returned an array of plain objects — a generic, name-agnostic reflection
 *   over whatever raw-record provider(s) this screen's own class happens to define (see
 *   attachRawRecords' own doc comment for how these get matched back onto renderVals()'s formatted
 *   output). `controlSamples` is, for every control whose `stateKey` is confirmed to be a REAL,
 *   live key of this instance's own initial `state` (never assumed from markup adjacency alone),
 *   the full renderVals() output re-computed at several other positions across that control's own
 *   declared min/max range — the raw material computeControlPayload() turns into a dependency list
 *   and a `steps` table.
 */
export function runScreenScript(scriptBody, propsDefaults, controls = [], timeoutMs = 5000) {
  const sandbox = {
    DCLogic: buildDCLogic(),
    React: buildReactStub(),
    __PROPS__: propsDefaults,
    __CONTROLS__: controls,
    __RESULT__: undefined,
    console, // so a screen script that logs for debugging doesn't crash the sandbox
  }
  vm.createContext(sandbox)

  const driver = `
${scriptBody}
;__RESULT__ = (function () {
  const __instance = new Component(__PROPS__);
  const __state = __instance.state === undefined ? {} : __instance.state;
  const __data = typeof __instance.renderVals === 'function' ? __instance.renderVals() : {};

  // Generic raw-record reflection (P0 fix — see extraction/parseMockup.js's own header comment
  // and DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §3/§7): a screen's own class frequently defines a
  // zero-argument helper method (e.g. "SLATE()") that returns the RAW records renderVals() then
  // formats into display strings — reflected over structurally (any zero-arg method returning an
  // array of plain objects), never by a hardcoded method name, so this works identically for any
  // workflow's own naming convention.
  const __rawCandidates = {};
  let __proto = Object.getPrototypeOf(__instance);
  const __seenMethodNames = new Set();
  while (__proto && __proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(__proto)) {
      if (__seenMethodNames.has(name)) continue;
      __seenMethodNames.add(name);
      if (name === 'constructor' || name === 'renderVals') continue;
      const fn = __proto[name];
      if (typeof fn !== 'function' || fn.length > 0) continue; // only zero-arg methods
      try {
        const result = fn.call(__instance);
        if (
          Array.isArray(result) &&
          result.length > 0 &&
          result.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))
        ) {
          __rawCandidates[name] = result;
        }
      } catch (e) {
        // Not a safe, side-effect-free zero-arg data provider (e.g. it called this.setState, which
        // this sandbox's DCLogic stub deliberately doesn't implement) — ignore, not a raw source.
      }
    }
    __proto = Object.getPrototypeOf(__proto);
  }

  // Multi-snapshot control sampling (P0 fix — the dependency-detection mechanism
  // DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §9/§11 calls the biggest missing capability): re-invoke
  // this SAME screen's own real renderVals() at several other positions across a confirmed
  // control's declared range, so a host-side diff (computeControlPayload, below) can see exactly
  // which other fields actually change — never guessed from visual/manifest adjacency.
  const __controlSamples = [];
  for (const control of __CONTROLS__) {
    // The markup's two-way-bound value name (e.g. "notchVal") is very often a DERIVED renderVals()
    // output, not a literal state field — the underlying raw state key (e.g. "notch") still drives
    // it, just under a different name. Resolved empirically, never guessed: try the exact name
    // first (the common case, e.g. S9.11's "tol" IS its own state key), and only when that's absent
    // fall back to testing each of this instance's OWN state fields in turn, keeping the first one
    // whose perturbation measurably changes the markup's own displayed field — confirmed by actually
    // re-running renderVals(), never assumed from name similarity or adjacency.
    let mutateKey = null;
    if (control.stateKey in __state) {
      mutateKey = control.stateKey;
    } else {
      for (const key of Object.keys(__state)) {
        const original = __state[key];
        if (typeof original !== 'number' && original !== null) continue;
        try {
          __instance.state[key] = control.min;
          const atMin = __instance.renderVals()[control.stateKey];
          __instance.state[key] = control.max;
          const atMax = __instance.renderVals()[control.stateKey];
          if (atMin !== undefined && atMax !== undefined && JSON.stringify(atMin) !== JSON.stringify(atMax)) {
            mutateKey = key;
            __instance.state[key] = original;
            break;
          }
        } catch (e) {
          // This state field isn't safely settable to the control's own range — not the right one.
        }
        __instance.state[key] = original;
      }
    }
    if (!mutateKey) continue; // no state field could be confirmed to drive this control — skip it

    const original = __instance.state[mutateKey];
    const displayDefault = __data[control.stateKey];
    const span = control.max - control.min;
    const positions = [0, 0.25, 0.5, 0.75, 1]
      .map((f) => control.min + f * span)
      .map((v) => {
        const snapped = Math.round((v - control.min) / control.step) * control.step + control.min;
        return Math.round(Math.min(control.max, Math.max(control.min, snapped)) * 1000) / 1000;
      });
    const uniquePositions = [...new Set(positions)];
    const samples = [];
    for (const position of uniquePositions) {
      __instance.state[mutateKey] = position;
      const sampleData = __instance.renderVals();
      if (sampleData[control.stateKey] !== displayDefault) samples.push({ value: sampleData[control.stateKey], data: sampleData });
    }
    __instance.state[mutateKey] = original;
    __controlSamples.push({ stateKey: control.stateKey, min: control.min, max: control.max, step: control.step, default: displayDefault, samples });
  }

  return { state: __state, data: __data, rawCandidates: __rawCandidates, controlSamples: __controlSamples };
})();
`

  vm.runInContext(driver, sandbox, { filename: 'dc-screen-script.js', timeout: timeoutMs })
  const result = sandbox.__RESULT__
  return {
    state: result.state,
    data: deepFlattenJsxNodes(result.data),
    rawCandidates: deepFlattenJsxNodes(result.rawCandidates),
    controlSamples: result.controlSamples.map((c) => ({
      ...c,
      samples: c.samples.map((s) => ({ value: s.value, data: deepFlattenJsxNodes(s.data) })),
    })),
  }
}

// ---- raw-record re-attachment (host side — plain data in, plain data out, no vm involved) --------

function isPlainObjectArray(v) {
  return Array.isArray(v) && v.length > 0 && v.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
}

/**
 * Matches each of renderVals()'s own formatted-display arrays back onto whichever raw-record
 * candidate (see runScreenScript's own reflection above) most plausibly produced it, and attaches
 * the raw record onto each formatted row as a non-destructive `__raw` companion — the FORMATTED
 * row (`prices: "$68.00 → $71.99"`) is kept exactly as-is (nothing here re-formats or removes
 * anything), the RAW row (`{ old: 68, nu: 71.99, ... }`) simply becomes reachable alongside it, so
 * a downstream classifier/renderer that needs real numbers (an uncertainty band, a nested control's
 * current selection) has them, without breaking anything that only ever wanted the display string.
 *
 * Matching is purely structural, never a hardcoded name: (1) a candidate whose OWN method name
 * matches the data key case-insensitively (e.g. "SLATE" <-> "slate") and has the same row count
 * wins first; (2) failing that, a candidate is used only when it's the UNIQUE same-length option
 * left — an ambiguous multi-candidate same-length match is left unattached rather than guessed at.
 */
export function attachRawRecords(data, rawCandidates) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  if (!rawCandidates || typeof rawCandidates !== 'object') return data
  const candidateEntries = Object.entries(rawCandidates).filter(([, arr]) => isPlainObjectArray(arr))
  if (candidateEntries.length === 0) return data

  const dataArrayKeys = Object.entries(data).filter(([, v]) => isPlainObjectArray(v))
  if (dataArrayKeys.length === 0) return data

  const usedCandidates = new Set()
  const assignments = new Map() // dataKey -> candidateName

  for (const [key, value] of dataArrayKeys) {
    const found = candidateEntries.find(
      ([name, arr]) => !usedCandidates.has(name) && arr.length === value.length && name.toLowerCase() === key.toLowerCase(),
    )
    if (found) {
      assignments.set(key, found[0])
      usedCandidates.add(found[0])
    }
  }
  for (const [key, value] of dataArrayKeys) {
    if (assignments.has(key)) continue
    const sameLength = candidateEntries.filter(([name, arr]) => !usedCandidates.has(name) && arr.length === value.length)
    if (sameLength.length === 1) {
      assignments.set(key, sameLength[0][0])
      usedCandidates.add(sameLength[0][0])
    }
  }

  if (assignments.size === 0) return data
  const out = { ...data }
  for (const [key, candidateName] of assignments) {
    const rawArr = rawCandidates[candidateName]
    out[key] = data[key].map((item, i) =>
      item !== null && typeof item === 'object' && !Array.isArray(item) ? { ...item, __raw: rawArr[i] } : item,
    )
  }
  return out
}

// ---- control dependency computation (host side) --------------------------------------------------

/** Structural equality that treats any two functions as equal (renderVals() recreates every closure
 * on each call, so two samples' otherwise-identical handler functions must never register as "this
 * changed" — see runScreenScript's own doc comment on why comparing them by reference/content would
 * be meaningless here). */
function valuesEqual(a, b) {
  if (a === b) return true
  if (typeof a === 'function' && typeof b === 'function') return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => valuesEqual(v, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && valuesEqual(a[k], b[k]))
  }
  return false
}

/**
 * Turns one control's base value + multi-position samples (both from runScreenScript above) into
 * the slider blockType's own real data shape: `{ min, max, step, value, dependencies, steps }`.
 * `dependencies` is exactly the set of OTHER top-level renderVals() keys whose value actually
 * differs somewhere across the sampled positions — computed by re-running the screen's own real
 * logic and diffing outputs, never fabricated from name/adjacency (DYNAMIC_COMPOSITION_FORENSIC_
 * AUDIT.md §9's explicit requirement). `steps` reuses the exact mechanism
 * blocks/sliderSteps.js's findNearestStep already expects (`{at, ...otherRawKey: itsValueAtThatPosition}`)
 * — dragging the rendered slider was ALREADY fully wired to look this up; the gap was purely that no
 * real fixture ever populated it (see manifests/REPORT.md and StageRenderer.jsx's own doc comment).
 *
 * @param {object} baseData - the fixture's own renderVals() output at the control's real initial value.
 * @param {{stateKey,min,max,step,default}} control
 * @param {Array<{value:number, data:object}>} samples - additional renderVals() outputs.
 */
export function computeControlPayload(baseData, control, samples) {
  const allSamples = [{ value: control.default, data: baseData }, ...samples]
  const dependencies = Object.keys(baseData)
    .filter((key) => key !== control.stateKey)
    .filter((key) => {
      const values = allSamples.map((s) => s.data[key])
      return !values.every((v) => valuesEqual(v, values[0]))
    })

  const steps = allSamples.map((s) => {
    const step = { at: s.value }
    for (const key of dependencies) step[key] = s.data[key]
    return step
  })

  return { min: control.min, max: control.max, step: control.step, value: control.default, dependencies, steps }
}
