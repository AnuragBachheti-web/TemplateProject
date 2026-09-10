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
 * @param {number} [timeoutMs]
 * @returns {{ state: object, data: object }} the screen's `this.state` and its `renderVals()` output.
 */
export function runScreenScript(scriptBody, propsDefaults, timeoutMs = 5000) {
  const sandbox = {
    DCLogic: buildDCLogic(),
    React: buildReactStub(),
    __PROPS__: propsDefaults,
    __RESULT__: undefined,
    console, // so a screen script that logs for debugging doesn't crash the sandbox
  }
  vm.createContext(sandbox)

  const driver = `
${scriptBody}
;__RESULT__ = (function () {
  const __instance = new Component(__PROPS__);
  return {
    state: __instance.state === undefined ? {} : __instance.state,
    data: typeof __instance.renderVals === 'function' ? __instance.renderVals() : {},
  };
})();
`

  vm.runInContext(driver, sandbox, { filename: 'dc-screen-script.js', timeout: timeoutMs })
  const result = sandbox.__RESULT__
  return { state: result.state, data: deepFlattenJsxNodes(result.data) }
}
