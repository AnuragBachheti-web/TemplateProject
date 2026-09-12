// Lightweight, throw-free manifest validation. Plain JS checks only (typeof, Array.isArray,
// required-key presence) — no schema library, matching the rest of this project.
//
// Validates one stage manifest: { code, stageKey, name, headline?, sections?, blocks: [...] }.
// Each file under src/features/action-stories/manifests/<code>.json is an array of these, one
// per stage — call validateManifest once per array entry.
//
// `headline` (Action Story instance identity, distinct from `name` — see generateManifests.js and
// FORENSIC_AUDIT_S9.1.md §6/§17), `sections[].region`, and each block's `role`/`region`/`layout`
// are all optional and purely additive: a manifest predating this schema (no `headline`, no
// `region` anywhere) is still fully valid. When present, they're type-checked like everything
// else here — loosely, never requiring a specific vocabulary of `role` values, so a future
// semantic role doesn't need a validator change to be legal.

import { BLOCK_TYPES } from './blockTypes.js'

const STAGE_KEYS = new Set(['reason', 'analyze', 'decide', 'execute', 'live'])
const KNOWN_BLOCK_TYPES = new Set(BLOCK_TYPES)
const REGIONS = new Set(['main', 'rail'])
const MIN_SPAN = 1
const MAX_SPAN = 12

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0
}

/**
 * @param {*} manifest - one stage manifest object.
 * @returns {string[]} problems found — empty array means the manifest is valid.
 */
export function validateManifest(manifest) {
  const problems = []

  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return [`manifest must be an object, got ${Array.isArray(manifest) ? 'array' : typeof manifest}`]
  }

  if (!isNonEmptyString(manifest.code)) {
    problems.push('"code" must be a non-empty string')
  }
  if (!isNonEmptyString(manifest.name)) {
    problems.push('"name" must be a non-empty string')
  }
  if (manifest.headline !== undefined && !isNonEmptyString(manifest.headline)) {
    problems.push('"headline" must be a non-empty string when present')
  }
  if (!isNonEmptyString(manifest.stageKey)) {
    problems.push('"stageKey" must be a non-empty string')
  } else if (!STAGE_KEYS.has(manifest.stageKey)) {
    problems.push(`"stageKey" "${manifest.stageKey}" is not one of: ${[...STAGE_KEYS].join(', ')}`)
  }

  if (!Array.isArray(manifest.blocks)) {
    problems.push(`"blocks" must be an array, got ${typeof manifest.blocks}`)
    return problems
  }

  const seenSlotNames = new Set()
  manifest.blocks.forEach((block, i) => {
    const where = `blocks[${i}]`
    if (block === null || typeof block !== 'object' || Array.isArray(block)) {
      problems.push(`${where}: must be an object`)
      return
    }
    if (!isNonEmptyString(block.slotName)) {
      problems.push(`${where}: "slotName" must be a non-empty string`)
    } else if (seenSlotNames.has(block.slotName)) {
      problems.push(`${where}: duplicate slotName "${block.slotName}"`)
    } else {
      seenSlotNames.add(block.slotName)
    }

    if (!isNonEmptyString(block.blockType)) {
      problems.push(`${where}: "blockType" must be a non-empty string`)
    } else if (!KNOWN_BLOCK_TYPES.has(block.blockType)) {
      problems.push(`${where}: unknown blockType "${block.blockType}"`)
    }

    if (!isNonEmptyString(block.binding)) {
      problems.push(`${where}: "binding" must be a non-empty string`)
    }

    if (block.role !== undefined && !isNonEmptyString(block.role)) {
      problems.push(`${where}: "role" must be a non-empty string when present`)
    }
    if (block.dependencies !== undefined) {
      if (!Array.isArray(block.dependencies) || !block.dependencies.every(isNonEmptyString)) {
        problems.push(`${where}: "dependencies" must be an array of non-empty strings when present`)
      }
    }
    if (block.region !== undefined && !REGIONS.has(block.region)) {
      problems.push(`${where}: "region" must be one of: ${[...REGIONS].join(', ')}`)
    }
    if (block.layout !== undefined) {
      if (block.layout === null || typeof block.layout !== 'object' || Array.isArray(block.layout)) {
        problems.push(`${where}: "layout" must be an object when present`)
      } else {
        if (block.layout.group !== undefined && !isNonEmptyString(block.layout.group)) {
          problems.push(`${where}: "layout.group" must be a non-empty string when present`)
        }
        if (block.layout.span !== undefined) {
          const span = block.layout.span
          if (typeof span !== 'number' || !Number.isFinite(span) || span < MIN_SPAN || span > MAX_SPAN) {
            problems.push(`${where}: "layout.span" must be a number between ${MIN_SPAN} and ${MAX_SPAN}`)
          }
        }
      }
    }
  })

  // A dependency is only meaningful when it names another real block in THIS SAME manifest — a
  // stale/typo'd reference (a slotName that got renamed, or never existed) fails loudly here rather
  // than silently resolving to "nothing depends on anything" at render time.
  manifest.blocks.forEach((block, i) => {
    if (!Array.isArray(block.dependencies)) return
    for (const dep of block.dependencies) {
      if (typeof dep === 'string' && !seenSlotNames.has(dep)) {
        problems.push(`blocks[${i}]: "dependencies" references unknown slotName "${dep}"`)
      }
    }
  })

  if (manifest.sections !== undefined) {
    if (!Array.isArray(manifest.sections)) {
      problems.push(`"sections" must be an array when present, got ${typeof manifest.sections}`)
    } else {
      manifest.sections.forEach((section, i) => {
        const where = `sections[${i}]`
        if (section === null || typeof section !== 'object' || Array.isArray(section)) {
          problems.push(`${where}: must be an object`)
          return
        }
        if (!isNonEmptyString(section.id)) {
          problems.push(`${where}: "id" must be a non-empty string`)
        }
        if (section.title !== undefined && section.title !== null && typeof section.title !== 'string') {
          problems.push(`${where}: "title" must be a string or null when present`)
        }
        if (section.region !== undefined && !REGIONS.has(section.region)) {
          problems.push(`${where}: "region" must be one of: ${[...REGIONS].join(', ')}`)
        }
      })
    }
  }

  return problems
}
