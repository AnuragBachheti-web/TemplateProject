// Lightweight, throw-free manifest validation. Plain JS checks only (typeof, Array.isArray,
// required-key presence) — no schema library, matching the rest of this project.
//
// Validates one stage manifest: { code, stageKey, name, headline?, sections?, blocks: [...] }.
// Each file under src/features/action-stories/manifests/<code>.json is an array of these, one
// per stage — call validateManifest once per array entry.
//
// `headline` (Action Story instance identity, distinct from `name` — see generateManifests.js and
// FORENSIC_AUDIT_S9.1.md §6/§17), `sections[].region`, and each block's `role`/`region`/`layout`/
// `when` are all optional and purely additive: a manifest predating this schema (no `headline`, no
// `region` anywhere) is still fully valid. When present, they're type-checked like everything
// else here — loosely, never requiring a specific vocabulary of `role` values, so a future
// semantic role doesn't need a validator change to be legal.
//
// `actions[]` (also optional/additive) is the template-driven action contract: what business
// action(s) this stage exposes, independent of any particular blockType or slotName vocabulary —
// see components/actionEligibility.js for how one is resolved against real data at render time.
//
// A block's own `when` (optional) is the CONDITIONAL RENDERING primitive: the same small, safe
// `when` predicate language actions use (manifests/actionCondition.js — evaluated by
// components/StageRenderer.jsx before a block ever reaches binding/validation/layout), now
// available on any block too — a block whose `when` evaluates false is entirely OMITTED from this
// stage's render, not shown as an empty/placeholder card. Absent `when` means "always render",
// identical to every manifest written before this field existed.

import { BLOCK_TYPES } from './blockTypes.js'
import { validateCondition } from './actionCondition.js'

const STAGE_KEYS = new Set(['reason', 'analyze', 'decide', 'execute', 'live'])
const KNOWN_BLOCK_TYPES = new Set(BLOCK_TYPES)
const REGIONS = new Set(['main', 'rail'])
const ACTION_KINDS = new Set(['primary', 'secondary', 'destructive'])
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
    if (block.when !== undefined) {
      problems.push(...validateCondition(block.when, `${where}.when`))
    }
    if (block.dependencies !== undefined) {
      if (!Array.isArray(block.dependencies) || !block.dependencies.every(isNonEmptyString)) {
        problems.push(`${where}: "dependencies" must be an array of non-empty strings when present`)
      }
    }
    // `selectable` marks the ONE block a page may attach row-selection state to (Approve-selected's
    // slate). Optional and additive: a template that never sets it renders exactly as before.
    if (block.selectable !== undefined && typeof block.selectable !== 'boolean') {
      problems.push(`${where}: "selectable" must be a boolean when present`)
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

  if (manifest.actions !== undefined) {
    if (!Array.isArray(manifest.actions)) {
      problems.push(`"actions" must be an array when present, got ${typeof manifest.actions}`)
    } else {
      const seenActionIds = new Set()
      manifest.actions.forEach((action, i) => {
        const where = `actions[${i}]`
        if (action === null || typeof action !== 'object' || Array.isArray(action)) {
          problems.push(`${where}: must be an object`)
          return
        }

        if (!isNonEmptyString(action.id)) {
          problems.push(`${where}: "id" must be a non-empty string`)
        } else if (seenActionIds.has(action.id)) {
          problems.push(`${where}: duplicate action id "${action.id}"`)
        } else {
          seenActionIds.add(action.id)
        }

        if (!isNonEmptyString(action.label)) {
          problems.push(`${where}: "label" must be a non-empty string`)
        }
        if (action.kind !== undefined && !ACTION_KINDS.has(action.kind)) {
          problems.push(`${where}: "kind" must be one of: ${[...ACTION_KINDS].join(', ')}`)
        }
        if (action.action !== undefined && !isNonEmptyString(action.action)) {
          problems.push(`${where}: "action" must be a non-empty string when present`)
        }
        if (action.labelBinding !== undefined && !isNonEmptyString(action.labelBinding)) {
          problems.push(`${where}: "labelBinding" must be a non-empty string when present`)
        }
        if (action.disabledReasonBinding !== undefined && !isNonEmptyString(action.disabledReasonBinding)) {
          problems.push(`${where}: "disabledReasonBinding" must be a non-empty string when present`)
        }
        if (action.loadingLabel !== undefined && !isNonEmptyString(action.loadingLabel)) {
          problems.push(`${where}: "loadingLabel" must be a non-empty string when present`)
        }

        if (action.when !== undefined) {
          problems.push(...validateCondition(action.when, `${where}.when`))
        }

        if (action.confirm !== undefined) {
          if (action.confirm === null || typeof action.confirm !== 'object' || Array.isArray(action.confirm)) {
            problems.push(`${where}: "confirm" must be an object when present`)
          } else {
            if (action.confirm.required !== undefined && typeof action.confirm.required !== 'boolean') {
              problems.push(`${where}.confirm: "required" must be a boolean when present`)
            }
            if (action.confirm.title !== undefined && !isNonEmptyString(action.confirm.title)) {
              problems.push(`${where}.confirm: "title" must be a non-empty string when present`)
            }
            if (action.confirm.description !== undefined && typeof action.confirm.description !== 'string') {
              problems.push(`${where}.confirm: "description" must be a string when present`)
            }
          }
        }

        if (action.reason !== undefined) {
          if (action.reason === null || typeof action.reason !== 'object' || Array.isArray(action.reason)) {
            problems.push(`${where}: "reason" must be an object when present`)
          } else {
            if (action.reason.required !== undefined && typeof action.reason.required !== 'boolean') {
              problems.push(`${where}.reason: "required" must be a boolean when present`)
            }
            if (action.reason.label !== undefined && !isNonEmptyString(action.reason.label)) {
              problems.push(`${where}.reason: "label" must be a non-empty string when present`)
            }
            if (action.reason.minLength !== undefined && (typeof action.reason.minLength !== 'number' || action.reason.minLength < 0)) {
              problems.push(`${where}.reason: "minLength" must be a non-negative number when present`)
            }
          }
        }
      })
    }
  }

  return problems
}
