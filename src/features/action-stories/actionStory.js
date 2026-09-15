// Action Story grouping — the parent/child relationship between an Action Story and its stages.
//
// THE DISTINCTION THIS FILE EXISTS TO ENFORCE:
//
//   Action Story   = the parent business/workflow identity  -> `story_code` (e.g. "S10.1")
//   Stage          = one step of that story                 -> `stage` ("reason" | "analyze" | ...)
//   Decision Object = the runtime business state AT a stage -> `proposal_id`
//
// A story with four stages is FOUR Decision Objects and ONE Action Story. The queue endpoint
// returns one row per Decision Object, which is correct — a stage genuinely has its own status,
// eligibility and payload — but a listing that renders those rows directly shows one Action Story
// four times, as four independent stories with the same title. That is the bug this module fixes,
// and it is fixed by grouping, not by changing what the API returns.
//
// NO NEW CONTRACT FIELD IS REQUIRED. `story_code` and `stage` are already on every Decision Object
// and every queue summary, and together they carry exactly the parent/child semantics needed.
//
// Pure functions only — no React, no store, no network, no service class. Grouping a list by a key
// it already carries does not need an architecture.

import { STAGES } from './contract/decisionObject'

/**
 * Canonical stage order. Taken from the contract's own STAGES rather than restated, so a stage
 * added there orders correctly here without a second edit.
 */
export const STAGE_ORDER = STAGES

/** Sorts stage keys into canonical order; anything unrecognised sorts last, in its original order. */
function byStageOrder(a, b) {
  const ai = STAGE_ORDER.indexOf(a.stage)
  const bi = STAGE_ORDER.indexOf(b.stage)
  return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi)
}

/**
 * @typedef {object} ActionStory
 * @property {string} story_code - the PARENT identity. One per Action Story, never per stage.
 * @property {string} title      - the story's own title (identical across its stages).
 * @property {Array<{stage: string, proposal_id: string, status: string}>} stages - in canonical order.
 * @property {string[]} stageKeys - just the stage names, for StepTracker.
 * @property {object} first      - the entry a listing should link to by default.
 */

/**
 * Groups queue rows (or full Decision Objects) into Action Stories.
 *
 * @param {Array<{story_code: string, stage: string, proposal_id: string, title?: string, status?: string}>} items
 * @returns {ActionStory[]} one entry per DISTINCT story_code, ordered by first appearance so the
 *   caller's own sort is preserved. Stages within a story are ordered canonically, not by arrival.
 */
export function groupProposalsIntoStories(items) {
  if (!Array.isArray(items)) return []

  const byStory = new Map()
  for (const item of items) {
    if (!item || typeof item.story_code !== 'string' || item.story_code === '') continue
    if (!byStory.has(item.story_code)) {
      byStory.set(item.story_code, {
        story_code: item.story_code,
        title: item.title ?? item.story_code,
        stages: [],
      })
    }
    const story = byStory.get(item.story_code)
    // A story's stages all carry the same title; take the first non-empty one rather than letting
    // a later stage with a missing title blank it out.
    if (!story.title && item.title) story.title = item.title
    // ONE Decision Object per (story, stage) — that is what `story_code` + `stage` mean. A queue
    // that returns the same stage twice (a paginated re-read, a test double seeded twice) would
    // otherwise produce two entries with the same `stage`, and StepTracker keys its steps by stage:
    // React then warns "two children with the same key" and may drop one (audit RB-6). Grouping is
    // where the parent/child relationship is enforced, so it is where the duplicate is dropped.
    if (story.stages.some((s) => s.stage === item.stage)) continue
    story.stages.push({
      stage: item.stage,
      proposal_id: item.proposal_id,
      status: item.status ?? null,
      on_clock: item.on_clock ?? false,
      deadline: item.deadline ?? null,
      impact: item.impact ?? null,
    })
  }

  return [...byStory.values()].map((story) => {
    const stages = [...story.stages].sort(byStageOrder)
    return {
      ...story,
      stages,
      stageKeys: stages.map((s) => s.stage),
      first: stages[0] ?? null,
    }
  })
}

/**
 * @param {ActionStory} story
 * @param {string} stageKey
 * @returns {{stage: string, proposal_id: string}|null} that story's Decision Object for one stage.
 */
export function findStage(story, stageKey) {
  return story?.stages.find((s) => s.stage === stageKey) ?? null
}

/**
 * The stage a listing should open a story at: its first incomplete stage, else its first stage.
 * Deliberately simple — "where the work is" is a product question, and until one is answered this
 * is the least surprising default rather than a guess dressed up as a rule.
 */
export function defaultStageOf(story) {
  if (!story || story.stages.length === 0) return null
  const open = story.stages.find((s) => s.status === 'pending')
  return (open ?? story.stages[0]).stage
}
