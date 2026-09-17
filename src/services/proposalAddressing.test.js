// Phase 1, T8: proposal addressing is EXPLICIT.
//
// Today lookup is (storyCode, stageKey) -> findStage -> first match, and a second Decision Object at
// the same (story, stage) is permanently unreachable. Two separate defects produce that:
//
//   actionStory.js:74   groupProposalsIntoStories silently `continue`s past the duplicate, so the
//                       second proposal is discarded BEFORE any lookup runs. This is the real point
//                       of loss (ruling (f)).
//   actionStory.js:101  findStage then `.find()`s the survivor and returns it as if it were the only
//                       answer.
//
// So this file exercises BOTH, and it exercises the grouping path rather than findStage in
// isolation — a test that only pinned findStage would pass against a bug that still ships.

import { describe, it, expect, beforeEach } from 'vitest'

import { groupProposalsIntoStories, findStage, AmbiguousStageError } from '@/features/action-stories/actionStory'
import { getStageView, resolveStageProposalId } from './actionStoriesService'
import { __resetMockApi, __seedProposal } from './mockDecisionApi'
import dataset from '@/features/action-stories/__corpus__/normalized/dataset.json'

const STORY = 'S9.98'

/** Two Decision Objects that legitimately share (story_code, stage) and differ only by proposal_id. */
function twin(proposalId, overrides = {}) {
  const base = structuredClone(dataset.find((d) => d.proposal_id === 'prop_s9_1_decide'))
  return {
    ...base,
    proposal_id: proposalId,
    story_code: STORY,
    stage: 'decide',
    ...overrides,
  }
}

const TWIN_A = () => twin('prop_dup_a', { title: 'Reprice the autumn range — option A' })
const TWIN_B = () => twin('prop_dup_b', { title: 'Reprice the autumn range — option B' })

beforeEach(() => {
  __resetMockApi()
  __seedProposal(TWIN_A())
  __seedProposal(TWIN_B())
})

describe('T8 — two proposals sharing (storyCode, stageKey) resolve to DISTINCT objects by proposalId', () => {
  it('resolves each twin to its own Decision Object', async () => {
    const viewA = await getStageView(STORY, 'decide', 'prop_dup_a')
    const viewB = await getStageView(STORY, 'decide', 'prop_dup_b')

    expect(viewA.decision.proposal_id).toBe('prop_dup_a')
    expect(viewB.decision.proposal_id).toBe('prop_dup_b')
    expect(viewA.decision.title).toBe('Reprice the autumn range — option A')
    expect(viewB.decision.title).toBe('Reprice the autumn range — option B')
    // Not the same object handed back twice.
    expect(viewA.decision.proposal_id).not.toBe(viewB.decision.proposal_id)
  })

  it('reaches the second twin — the one that is unreachable today', async () => {
    // `prop_dup_b` sorts second and is the one actionStory.js:74 discards. Addressing it by id must
    // work regardless of what the queue ordering happens to be.
    const view = await getStageView(STORY, 'decide', 'prop_dup_b')
    expect(view.decision.proposal_id).toBe('prop_dup_b')
  })

  it('still resolves a story whose stages are unambiguous', async () => {
    // The overwhelmingly common case must not have become harder. S9.1 is one of the 26 shipped
    // stories: four stages, all distinct.
    const view = await getStageView('S9.1', 'decide', 'prop_s9_1_decide')
    expect(view.decision.proposal_id).toBe('prop_s9_1_decide')
    expect(view.manifest).toBeTruthy()
  })
})

describe('T8 — the ambiguous (storyCode, stageKey) lookup fails LOUDLY instead of guessing', () => {
  it('groupProposalsIntoStories throws on a duplicate (story_code, stage) — the actual point of loss', () => {
    expect(() => groupProposalsIntoStories([TWIN_A(), TWIN_B()])).toThrow(AmbiguousStageError)
  })

  it('names both proposals in the failure, so the ambiguity is diagnosable', () => {
    let thrown
    try {
      groupProposalsIntoStories([TWIN_A(), TWIN_B()])
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(AmbiguousStageError)
    expect(thrown.message).toContain(STORY)
    expect(thrown.message).toContain('decide')
    expect(thrown.message).toContain('prop_dup_a')
    expect(thrown.message).toContain('prop_dup_b')
  })

  it('does NOT throw on a genuinely repeated row — the same proposal_id read twice', () => {
    // A paginated re-read or a double-seeded test double returns the SAME Decision Object twice.
    // That is not ambiguity, it is duplication, and collapsing it is correct (audit RB-6).
    const story = groupProposalsIntoStories([TWIN_A(), TWIN_A()])
    expect(story).toHaveLength(1)
    expect(story[0].stages).toHaveLength(1)
    expect(story[0].stages[0].proposal_id).toBe('prop_dup_a')
  })

  it('findStage throws on an ambiguous story as a second net', () => {
    // Reached only if a grouping is assembled some other way; kept because a silent first-match on
    // ambiguous input is the same class of bug as the one this phase fixes.
    const ambiguous = {
      story_code: STORY,
      stages: [
        { stage: 'decide', proposal_id: 'prop_dup_a' },
        { stage: 'decide', proposal_id: 'prop_dup_b' },
      ],
    }
    expect(() => findStage(ambiguous, 'decide')).toThrow(AmbiguousStageError)
  })

  it('findStage still returns the single match, and null for a stage the story lacks', () => {
    const [story] = groupProposalsIntoStories(dataset.filter((d) => d.story_code === 'S9.1'))
    expect(findStage(story, 'decide').proposal_id).toBe('prop_s9_1_decide')
    expect(findStage(story, 'nonexistent')).toBeNull()
    expect(findStage(null, 'decide')).toBeNull()
  })

  it('resolveStageProposalId refuses to guess, as safe operator copy rather than a raw throw', async () => {
    await expect(resolveStageProposalId(STORY, 'decide')).rejects.toMatchObject({
      code: 'MALFORMED',
    })
    const error = await resolveStageProposalId(STORY, 'decide').catch((e) => e)
    expect(error.userMessage.trim()).not.toBe('')
    expect(error.userMessage).not.toContain('prop_dup_a')
  })

  it('resolveStageProposalId still works for the redirect path when the stage is unambiguous', async () => {
    const { proposalId } = await resolveStageProposalId('S9.1', 'decide')
    expect(proposalId).toBe('prop_s9_1_decide')
  })
})
