// THE PLACEHOLDER INVENTORY — Phase 4 Part 1's handover artefact.
//
// Phase 4 Part 1 populated five header fields on all 105 Decision Objects with invented values, on
// the product owner's decision, for a prototype with no backend. The non-negotiable condition on
// that reversal was that a placeholder stay distinguishable from reference-derived data BY MACHINE,
// FOREVER (R35). provenance.json is where that lives: per object, per field, the raw reference key
// that produced the value, `null` where the reference is silent, and `(placeholder)` where this
// pipeline invented one.
//
// This script renders that same fact for a human. It READS provenance and never restates it — a
// hand-maintained list of what is invented would be wrong the first time the generator changed, and
// wrong silently, which is the one failure mode the marker exists to prevent.
//
//   node scripts/placeholderInventory.mjs > src/features/action-stories/__corpus__/PLACEHOLDERS.md
//
// Whoever connects the real API reads this file to know exactly which values must be replaced and
// which 54 must not be touched.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const NORMALIZED = path.resolve(HERE, '../src/features/action-stories/__corpus__/normalized')

const read = (name) => JSON.parse(fs.readFileSync(path.join(NORMALIZED, name), 'utf8'))
const dataset = read('dataset.json')
const provenance = read('provenance.json')

const PLACEHOLDER = '(placeholder)'
/** The five R39 permitted this phase to fill, and only these. `confidence` was ruled OUT. */
const FIELDS = ['brand', 'channel', 'category', 'agent', 'impact']
const WIDTH = { brand: 11, channel: 11, category: 15, agent: 30 }

const isInvented = (id, field) => provenance[id]?.[field] === PLACEHOLDER

/** The impact's own shape says more than its number: an unsigned magnitude is a first-class state. */
function impactText(impact) {
  if (impact === null || impact === undefined) return '(null)'
  if (impact.signed === false) return `${impact.value} unsigned ${impact.unit}`
  return `${impact.value > 0 ? '+' : ''}${impact.value} ${impact.unit}`
}

const out = []
const say = (line = '') => out.push(line)

say('PLACEHOLDER INVENTORY — Phase 4 Part 1')
say()
say('GENERATED FROM provenance.json — never hand-written (R35). Regenerate with:')
say('  node scripts/placeholderInventory.mjs > src/features/action-stories/__corpus__/PLACEHOLDERS.md')
say()
say('THE HANDOVER CONTRACT. Every value marked * below is INVENTED for the prototype and must be')
say('replaced when a real API is connected. Every value NOT marked is derived from the reference')
say('corpus and must not be changed — those 54 are pinned byte-identical by T42 against a snapshot')
say('taken before Part 1 wrote anything (__snapshots__/reference-derived-header.json).')
say()
say('The machine-readable source of truth is provenance.json: a field whose recorded source reads')
say(`"${PLACEHOLDER}" is invented. This file is that same fact, made readable.`)
say()

say('TOTALS  (of 105 objects each)')
for (const field of FIELDS) {
  const invented = dataset.filter((d) => isInvented(d.proposal_id, field)).length
  say(`  ${field.padEnd(9)} invented ${String(invented).padStart(3)}   reference-derived ${String(105 - invented).padStart(3)}`)
}
say()
say('VALUE SPACES — no new name was minted (R36). Brands and categories come from the corpus\'s own')
say('vocabulary; channels from the contract enum; agents from a sibling stage\'s own `proposal.agents`.')
for (const field of ['brand', 'category', 'channel']) {
  say(`  ${field.padEnd(9)} ${[...new Set(dataset.map((d) => d[field]))].sort().join(', ')}`)
}
say()
say('LEGEND  * = invented')
say()

const header = ['OBJECT'.padEnd(22), 'BRAND'.padEnd(WIDTH.brand + 1), 'CHANNEL'.padEnd(WIDTH.channel + 1),
  'CATEGORY'.padEnd(WIDTH.category + 1), 'AGENT'.padEnd(WIDTH.agent + 1), 'IMPACT'].join('')
say(`  ${header}`)
say(`  ${'-'.repeat(header.length + 6)}`)

let story = null
for (const d of dataset) {
  if (d.story_code !== story) {
    story = d.story_code
    say()
  }
  const cell = (field) => {
    const value = d[field] === null ? '(null)' : String(d[field])
    return (value + (isInvented(d.proposal_id, field) ? '*' : ' ')).padEnd(WIDTH[field] + 1)
  }
  const impact = impactText(d.impact) + (isInvented(d.proposal_id, 'impact') ? '*' : '')
  say(`  ${d.proposal_id.padEnd(22)}${cell('brand')}${cell('channel')}${cell('category')}${cell('agent')}${impact}`)
}

process.stdout.write(`${out.join('\n')}\n`)
