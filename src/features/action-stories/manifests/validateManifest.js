// Lightweight, throw-free manifest validation. Plain JS checks only (typeof, Array.isArray,
// required-key presence) — no schema library, matching the rest of this project.
//
// Validates one stage manifest: { code, stageKey, name, blocks: [{ slotName, blockType, binding }] }.
// Each file under src/features/action-stories/manifests/<code>.json is an array of these, one
// per stage — call validateManifest once per array entry.

import { BLOCK_TYPES } from './blockTypes.js'

const STAGE_KEYS = new Set(['reason', 'analyze', 'decide', 'execute', 'live'])
const KNOWN_BLOCK_TYPES = new Set(BLOCK_TYPES)

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
  })

  return problems
}
