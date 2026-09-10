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
