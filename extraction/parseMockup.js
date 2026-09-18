// Pure parsing helpers for one .dc.html mockup file's text. No filesystem or vm access here —
// that split is what makes these independently testable.

export const STAGE_ORDER = ['reason', 'analyze', 'decide', 'execute', 'live']

// Filename shape: <code>-<stageNum>-<stageName>[-<suffix>].dc.html
//   S9.11-1-reason.dc.html            -> code S9.11, stageNum 1, stageName reason
//   S9.2-1-reason-standalone.dc.html  -> suffix "standalone" (duplicate export, caller skips it)
const FILENAME_RE =
  /^(?<code>[A-Za-z]+\d+(?:\.\d+)?)-(?<stageNum>\d)-(?<stageName>[a-z]+)(?:-(?<suffix>[a-zA-Z0-9]+))?\.dc\.html$/

const STAGE_NUM_TO_KEY = { 1: 'reason', 2: 'analyze', 3: 'decide', 4: 'execute', 5: 'live' }

// Files that are known to not be story data, independent of what the filename pattern says.
const KNOWN_NON_STORY_FILES = new Set([
  'Canvas.dc.html',
  'S9.2-1-reason-standalone.dc.html',
  'Realify S9.2 Reason - Replenishment.html',
])

/**
 * Decides whether a filename is a real, canonical stage file, and if so what it identifies.
 * Never throws — an unrecognized name is reported back as a skip reason, not an error.
 */
export function classifyFilename(filename) {
  if (KNOWN_NON_STORY_FILES.has(filename)) {
    return { skip: true, reason: 'known duplicate export / shared shell / empty file' }
  }
  if (/^S00-/.test(filename)) {
    return { skip: true, reason: 'shared shell (S00-*), not story data' }
  }
  if (!filename.endsWith('.dc.html')) {
    return { skip: true, reason: 'not a .dc.html file' }
  }

  const m = filename.match(FILENAME_RE)
  if (!m) {
    return { skip: true, reason: 'filename does not match <code>-<stageNum>-<stageName>.dc.html' }
  }

  const { code, stageNum, stageName, suffix } = m.groups
  if (suffix) {
    return { skip: true, reason: `duplicate export (suffix "-${suffix}")` }
  }

  const stageKeyFromNumber = STAGE_NUM_TO_KEY[stageNum]
  const warnings = []
  if (!stageKeyFromNumber) {
    warnings.push(`unrecognized stage number "${stageNum}" in filename`)
  } else if (stageKeyFromNumber !== stageName) {
    warnings.push(
      `stage number "${stageNum}" (expected "${stageKeyFromNumber}") doesn't match stage name "${stageName}" in filename`,
    )
  }

  // The word in the filename is what the rest of the pipeline keys folders/files by; the number
  // is only a cross-check against the documented 1=reason..5=live mapping.
  return { skip: false, code, stageKey: stageName, warnings }
}

/**
 * Finds the single <script type="text/x-dc" data-dc-script data-props="..."> block.
 * Returns { openTag, body } or null if no such block exists.
 */
export function extractDcScriptTag(html) {
  const re = /<script\b[^>]*\bdata-dc-script\b[^>]*>([\s\S]*?)<\/script>/i
  const m = html.match(re)
  if (!m) return null
  const openTagMatch = m[0].match(/^<script\b[^>]*>/i)
  return { openTag: openTagMatch ? openTagMatch[0] : '', body: m[1] }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Parses the JSON in a script tag's data-props="..." (or data-props='...') attribute. Throws if
 * the attribute is present but isn't valid JSON; returns {} if there's no data-props attribute.
 *
 * Can't use a lazy "up to the next matching quote" regex here: the export is inconsistent about
 * escaping. Most files HTML-escape real quotes as &quot; inside a "-delimited attribute, but some
 * emit raw, un-escaped JSON inside a '-delimited attribute — and that JSON can itself contain a
 * literal `'` (e.g. a `"tsType":"'Suggest' | 'Approve' | 'Auto'"` field), which would terminate a
 * lazy match after just a few characters. data-props is always the last attribute on the tag, so
 * instead this takes everything from the opening quote to that same quote character's LAST
 * occurrence in the tag (its real closing quote, immediately before the tag's own `>`).
 */
export function parseDataProps(openTag) {
  const start = openTag.match(/data-props\s*=\s*(["'])/i)
  if (!start) return {}
  const quote = start[1]
  const contentStart = start.index + start[0].length
  const contentEnd = openTag.lastIndexOf(quote)
  if (contentEnd <= contentStart) {
    throw new Error('could not find a closing quote for the data-props attribute')
  }
  const raw = decodeHtmlEntities(openTag.slice(contentStart, contentEnd))
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`data-props JSON parse failed: ${err.message}`)
  }
}

/**
 * data-props documents each editable prop as either a bare default value or a descriptor object
 * like {"type":"enum","options":[...],"default":"Suggest"}. Either way, a screen's own class body
 * reads `this.props.<name>` expecting the plain default value, so this flattens descriptors down
 * to just their `default`.
 */
export function flattenPropsDefaults(propsSchema) {
  const flat = {}
  for (const [key, def] of Object.entries(propsSchema || {})) {
    if (def && typeof def === 'object' && !Array.isArray(def) && 'default' in def) {
      flat[key] = def.default
    } else {
      flat[key] = def
    }
  }
  return flat
}

/**
 * The breadcrumb `>NAME · CODE<` in a screen's visible markup is the only authoritative name for
 * that screen — different shell/nav files in this export map codes to names inconsistently, so
 * this is deliberately per-file rather than looked up from any shared nav data.
 */
export function extractBreadcrumbName(html, code) {
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp('>\\s*([^<·]+?)\\s*·\\s*' + escapedCode + '\\s*<')
  const m = html.match(re)
  return m ? decodeHtmlEntities(m[1].trim()) : null
}

/**
 * The Action Story INSTANCE headline — a different concept from extractBreadcrumbName's workflow/
 * category label, and a different DOM node. Every stage screen's own context banner (the bordered
 * strip right under the breadcrumb) carries two distinct pieces of text: a small mono badge
 * (`>NAME · CODE<`, the workflow/category identity extractBreadcrumbName reads) and, as its own
 * sibling `<div>` right below it, one real per-instance sentence naming *this specific run*
 * ("Quarterly assortment review — 214 active SKUs", "Competitor undercut — hero SKU, −7% · Buy Box
 * lost 2h ago", ...). Confirmed present, with this exact style signature, in every stage file
 * checked across multiple workflows (S9.1, S9.2, S9.5, S10.1, ...) — a consistent shell pattern,
 * not a one-off. FORENSIC_AUDIT_S9.1.md §4/§6/§17 documents that this text existed only in this
 * static markup and was never captured by any extraction function before this one — silently
 * discarded on every prior extraction run, not merely unclassified downstream.
 *
 * Deliberately matched by its exact, distinctive inline style (not by DOM position/adjacency to
 * the badge) — regex-based extraction has no real DOM tree to walk, and this style string is
 * unique to this one banner element across every mockup file inspected.
 */
const INSTANCE_HEADLINE_RE = /<div style="font-size:15px;font-weight:700;color:var\(--ink-900\)">([^<]*)<\/div>/

export function extractInstanceHeadline(html) {
  const m = html.match(INSTANCE_HEADLINE_RE)
  if (!m) return null
  const text = decodeHtmlEntities(m[1].trim())
  // A handful of stage screens (confirmed: S10.3, S10.6) template this banner from per-instance
  // component state instead of a static literal — this static-markup regex has no script sandbox
  // to evaluate that against, so it can only ever see the raw, unresolved `{{ expr }}` mustache
  // text still sitting in the export. Surfacing that literally as a user-facing subtitle would be
  // worse than having none at all (raw template syntax leaking into the UI) — treated the same as
  // "no banner found."
  return /\{\{.*\}\}/.test(text) ? null : text
}

// ---- slot heading extraction --------------------------------------------------------------------
//
// Every panel the reference gives its own bespoke caption ("What raised this", "The opportunity",
// "Roll or test, by cohort", ...) writes that caption as a literal `<span>` in this exact mono
// micro-label style, immediately ahead of the `{{ binding }}` it captions — never inside the
// `<script data-dc-script>` block (that block holds logic/data, never this markup). Nothing upstream
// of this ever captured that text: extraction kept the DATA under each binding and discarded the
// heading string that named it, which is why the running app falls back to a generic
// humanizeSlotName(slotName) label instead of the reference's own words.
const SLOT_HEADING_RE =
  /<span style="font-family:var\(--font-mono\);font-size:9\.5px;letter-spacing:0\.14em;text-transform:uppercase;color:var\(--ink-500\)">([^<]*)<\/span>/g

const MUSTACHE_BINDING_RE = /\{\{\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\}\}/

/**
 * @param {string} html - the WHOLE mockup file's text.
 * @returns {Record<string, string>} rawKey -> the heading text the reference itself gave that
 *   binding's panel. Deliberately narrow: a heading only counts if a bare-identifier `{{ binding }}`
 *   (list or scalar) is the FIRST one found between it and the next heading (or end of file) — the
 *   same "structural, never guessed" posture as extractControlElements. A heading with no binding in
 *   its own window (e.g. "Dial", a purely static control with no data slot) is simply omitted, never
 *   fabricated. The FIRST heading seen for a given rawKey wins if one ever repeats.
 */
export function extractSlotHeadings(html) {
  const headingMatches = [...html.matchAll(SLOT_HEADING_RE)]
  const headings = {}
  for (let i = 0; i < headingMatches.length; i++) {
    const m = headingMatches[i]
    const text = decodeHtmlEntities(m[1].trim())
    if (!text) continue

    const windowStart = m.index + m[0].length
    const windowEnd = i + 1 < headingMatches.length ? headingMatches[i + 1].index : html.length
    const window = html.slice(windowStart, windowEnd)

    const bindingMatch = window.match(MUSTACHE_BINDING_RE)
    if (!bindingMatch) continue

    const rawKey = bindingMatch[1]
    if (!(rawKey in headings)) headings[rawKey] = text
  }
  return headings
}

// ---- interactive control extraction (P0 fix: DYNAMIC_COMPOSITION_FORENSIC_AUDIT.md §2/§9) ------
//
// A mockup's interactive control (a range slider, today — the only control shape found anywhere in
// the reference corpus) lives entirely in the screen's TEMPLATE MARKUP as a plain HTML `<input>`
// with literal `min`/`max`/`step` attributes and a two-way-bound `value="{{ stateKey }}"` mustache
// expression — never inside the `<script data-dc-script>` block extractDcScriptTag reads (that
// block only holds the screen's *logic*, not its markup). The forensic audit's S9.11 Decide deep
// dive confirmed this is exactly why a slider's bounds could never be recovered before: nothing
// upstream of this function ever looked at the template markup at all, only at renderVals()'s
// return VALUE (the current position, not the control's own declared range).
//
// Deliberately narrow and structural, not name-based: matches ONLY a literal
// `<input type="range" ...>` tag, reads its own `min`/`max`/`step` attributes verbatim (never
// guessed/inferred when absent — per the task's own "no fabricated bounds" rule), and only resolves
// a `value="{{ EXPR }}"` binding when EXPR is a bare identifier (no dots, no calls) — anything more
// complex is left unrecognized rather than guessed at. Works identically for any workflow's markup;
// nothing here reads a filename, a workflow code, or a stage name.
const RANGE_INPUT_RE = /<input\b[^>]*\btype=["']range["'][^>]*>/gi
const ATTR_RE = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g
const BARE_IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function parseTagAttrs(tag) {
  const attrs = {}
  let m
  ATTR_RE.lastIndex = 0
  while ((m = ATTR_RE.exec(tag))) {
    attrs[m[1].toLowerCase()] = m[2]
  }
  return attrs
}

/** Strips a mustache `{{ expr }}` wrapper and returns the trimmed inner expression, or null if the
 * attribute isn't mustache-bound at all (a literal value, not a template binding). */
function mustacheExpr(rawAttrValue) {
  const m = typeof rawAttrValue === 'string' && rawAttrValue.match(/^\{\{\s*(.*?)\s*\}\}$/)
  return m ? m[1] : null
}

/**
 * @param {string} html - the WHOLE mockup file's text (not just the data-dc-script block).
 * @returns {Array<{ type: 'range', stateKey: string, min: number, max: number, step: number }>}
 *   One entry per recognized range input — only entries whose `value` binds to a bare state-key
 *   identifier and whose `min`/`max` are both real, present, finite numbers are returned; anything
 *   else (a computed expression, a missing bound) is silently skipped rather than guessed at.
 */
export function extractControlElements(html) {
  const controls = []
  const tags = html.match(RANGE_INPUT_RE) || []
  for (const tag of tags) {
    const attrs = parseTagAttrs(tag)
    const stateKey = mustacheExpr(attrs.value)
    if (!stateKey || !BARE_IDENTIFIER_RE.test(stateKey)) continue

    const min = Number(attrs.min)
    const max = Number(attrs.max)
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) continue
    const step = Number.isFinite(Number(attrs.step)) && Number(attrs.step) > 0 ? Number(attrs.step) : 1

    controls.push({ type: 'range', stateKey, min, max, step })
  }
  return controls
}
