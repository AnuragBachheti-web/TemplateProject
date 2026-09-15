// Per-Action-Story business context, read from the REFERENCE mockups' own markup.
//
// WHY THIS FILE EXISTS. Three contract axes — `lens`, `persona` and the agent roster — are real
// business facts that the reference states plainly, in the persistent "pinned" identity strip every
// one of its 105 stage screens carries:
//
//     Lens: Sales · Margin        Merchandiser + Prospector        Forecaster    Role Classifier
//     ^ lens line                 ^ persona pill                   ^ agent pills
//
// They were never captured by `extraction/extract.js`, because that script snapshots the DC
// component's `renderVals()` output and these three live in the surrounding *markup*, not in the
// view model. The consequence, measured in docs/REFERENCE_TO_TEMPLATE_BLOCK_AUDIT.md, was that
// `normalizeCorpus.js` fell back to `LENSES[hash % 5]` / `PERSONAS[hash % 7]` — synthesised values
// with no business meaning that nonetheless drove 321 of 712 rendered slot instances.
//
// This module recovers them. It is BUILD-TIME ONLY (the runtime never imports it) and it reads the
// mockups committed under `source-mockups/`, which are the reference project verbatim.
//
// It extracts ONLY business identity. It does not read markup for layout, tone, geometry or copy —
// those remain, correctly, out of the business contract.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MOCKUPS = path.resolve(__dirname, '../source-mockups')

/** The contract's five lenses, matched case-insensitively against the reference's own lens line. */
const KNOWN_LENSES = ['ads', 'cash', 'inventory', 'margin', 'sales']

/**
 * The reference's operator personas, taken verbatim from its persona pills across all 26 stories.
 * This is a SUPERSET of the seven the contract originally declared — see
 * contract/decisionObject.js's PERSONAS, for which this list is the evidence.
 */
const KNOWN_PERSONAS = [
  'arbiter', 'bidder', 'controller', 'keeper', 'merchandiser', 'navigator', 'planner',
  'pricer', 'promoter', 'prospector', 'scout', 'shipper', 'sourcer', 'steward',
]

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

/** Every mockup filename belonging to one story code, reason first (the pinned strip is identical across stages). */
function filesFor(code) {
  if (!fs.existsSync(MOCKUPS)) return []
  return fs
    .readdirSync(MOCKUPS)
    .filter((f) => f.startsWith(`${code}-`) && f.endsWith('.dc.html') && !f.includes('standalone'))
    .sort()
    .map((f) => path.join(MOCKUPS, f))
}

/**
 * The pinned strip, parsed. The persona pill is the one immediately after the lens line, carrying
 * the reference's own inline `<svg>` "who" glyph; the agent pills are the mono-styled ones marked
 * with the `fa-gears` icon. Both markers are used verbatim across all 26 stories.
 */
function parsePinnedStrip(src) {
  const lensMatch = /Lens:\s*([^<]+)</.exec(src)
  if (!lensMatch) return null
  const after = src.slice(lensMatch.index + lensMatch[0].length, lensMatch.index + 12_000)
  const personaPill = /<\/svg>\s*([^<>{}]{2,140}?)\s*</.exec(after)?.[1]
  const agents = [...src.matchAll(/fa-gears[^>]*><\/i>\s*([^<]{2,60}?)\s*</g)].map((m) => decodeEntities(m[1]).trim())
  return {
    lensLine: decodeEntities(lensMatch[1]).trim(),
    personaPill: personaPill === undefined ? null : decodeEntities(personaPill).trim(),
    agents,
  }
}

/**
 * The lenses named on this screen, in the reference's own order. The reference orders them
 * primary-first ("Sales · Margin" on an assortment review whose figures are revenue-led), so
 * `lenses[0]` is the proposal's primary lens.
 *
 * `"all five"` (S10.6 Peak readiness) is the one screen that declares no primary — it is returned
 * as an empty list plus `spansAllLenses: true` rather than being collapsed to an arbitrary pick.
 */
function parseLensLine(lensLine) {
  if (/all five/i.test(lensLine)) return { lenses: [], spansAllLenses: true }
  const lenses = lensLine
    .split(/[·,]/)
    .map((p) => p.trim().toLowerCase())
    .map((p) => KNOWN_LENSES.find((l) => p === l || p.startsWith(l)))
    .filter(Boolean)
  return { lenses: [...new Set(lenses)], spansAllLenses: false }
}

/**
 * The LEAD persona. The reference's pill names the whole operating group and marks the lead first:
 * "Merchandiser + Prospector", "Pricer, Controller governs", "Scout lead; Pricer, Merchandiser,
 * Bidder respond". In every one of the 26 the lead is the first persona word in the string.
 */
function parsePersona(pill) {
  if (typeof pill !== 'string') return null
  const words = pill.toLowerCase().match(/[a-z]+/g) ?? []
  return words.find((w) => KNOWN_PERSONAS.includes(w)) ?? null
}

const CACHE = new Map()

/**
 * @param {string} code - an Action Story code ("S9.1").
 * @returns {{lenses: string[], lensLabel: string|null, spansAllLenses: boolean, persona: string|null,
 *            personaLabel: string|null, agents: string[]}} everything the reference states about
 *   who this proposal belongs to. Empty/null fields mean the reference did not say — never a guess.
 */
export function referenceContextFor(code) {
  if (CACHE.has(code)) return CACHE.get(code)

  const empty = { lenses: [], lensLabel: null, spansAllLenses: false, persona: null, personaLabel: null, agents: [] }
  let result = empty

  for (const file of filesFor(code)) {
    const parsed = parsePinnedStrip(fs.readFileSync(file, 'utf8'))
    if (!parsed) continue
    const { lenses, spansAllLenses } = parseLensLine(parsed.lensLine)
    result = {
      lenses,
      lensLabel: parsed.lensLine,
      spansAllLenses,
      persona: parsePersona(parsed.personaPill),
      personaLabel: parsed.personaPill,
      // The agent roster: the named models the reference credits on this story ("Role Classifier",
      // "GMROI Engine", "Probabilistic Forecast Engine"). Distinct from `persona` — a persona is a
      // human operator, an agent is a model — which is exactly the distinction the old
      // `roles` <- `agents` mapping collapsed.
      agents: [...new Set(parsed.agents)],
    }
    break // the pinned strip is identical across a story's stages; the first file is authoritative
  }

  CACHE.set(code, result)
  return result
}

export const REFERENCE_PERSONAS = KNOWN_PERSONAS
