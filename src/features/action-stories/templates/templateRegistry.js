// template id -> canonical template. A frozen object, deliberately shaped exactly like
// blocks/index.js's BLOCK_REGISTRY so the two read as the same idea: a lookup table, not a system.
//
// No inheritance, no composition engine, no registry DSL, no versioning framework. A template's
// version lives in its own id (`decide.slate.v1`), which is sufficient until there is a v2 — at
// which point v2 is one more file and one more entry, and v1 keeps working for anything still
// pointing at it.

import reasonV1 from './reason.v1.json'
import analyzeCompareV1 from './analyze.compare.v1.json'
import decideSlateV1 from './decide.slate.v1.json'
import executeBridgeV1 from './execute.bridge.v1.json'
import lockedV1 from './locked.v1.json'

import { validateManifest } from '@/features/action-stories/manifests/validateManifest'
import { selectTemplate, SELECTABLE_TEMPLATE_IDS } from './selectTemplate'

export const TEMPLATE_REGISTRY = Object.freeze({
  'reason.v1': reasonV1,
  'analyze.compare.v1': analyzeCompareV1,
  'decide.slate.v1': decideSlateV1,
  'execute.bridge.v1': executeBridgeV1,
  'locked.v1': lockedV1,
})

// A selector row pointing at a template that does not exist is a bug that should surface on import,
// not on the one route that happens to hit it.
for (const id of SELECTABLE_TEMPLATE_IDS) {
  if (!TEMPLATE_REGISTRY[id]) {
    throw new Error(`[templateRegistry] selectTemplate can return "${id}" but no template is registered for it`)
  }
}

/** @returns {object|null} the raw template, or null for an unknown id. */
export function getTemplate(templateId) {
  return TEMPLATE_REGISTRY[templateId] ?? null
}

/**
 * Validates a template using the EXISTING manifest validator — templates are manifests, minus the
 * per-workflow identity a template by definition does not have. Rather than write a second
 * validator (and then maintain two drifting copies of the same block/section/action rules), the
 * three identity fields validateManifest requires are supplied from the template's own id and the
 * stage it serves.
 *
 * @param {object} template
 * @param {string} [stage] - the stage to validate against; defaults to the template's own declared
 *   stage. `locked.v1` declares `null` because it serves every stage, so it needs one passed in.
 * @returns {string[]} problems; empty means valid.
 */
export function validateTemplate(template, stage) {
  if (template === null || typeof template !== 'object') return ['template must be an object']
  const stageKey = stage ?? template.stage
  return validateManifest({
    ...template,
    code: template.template_id,
    name: template.template_id,
    stageKey,
  })
}

/**
 * The template layer's single entry point: a Decision Object in, a render-ready manifest out.
 *
 * The returned object is an ordinary manifest — StageRenderer, composeSections, StageSections,
 * resolveBinding and StageActionBar consume it with no knowledge that a template layer exists at
 * all. That is the whole design: one function was added above the renderer, and nothing below it
 * changed.
 *
 * @param {object} decision - a validated Decision Object.
 * @returns {{ templateId: string, manifest: object }|null} `null` when no template applies — the
 *   caller must render an explicit unsupported state. Never a fallback template.
 */
export function resolveTemplate(decision) {
  const templateId = selectTemplate(decision)
  if (templateId === null) return null

  const template = getTemplate(templateId)
  if (!template) return null

  return {
    templateId,
    manifest: {
      ...template,
      // Identity comes from the DECISION, never from the template — this is what makes one template
      // serve every proposal. `code` and `stageKey` exist only because StageRenderer already uses
      // them to label its console diagnostics.
      code: decision.story_code,
      name: decision.title,
      stageKey: decision.stage,
    },
  }
}
