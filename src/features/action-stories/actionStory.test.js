// Action Story ↔ Stage grouping: the parent/child model, at the data level.
//
// The bug this guards against is specific: one Action Story with four stages rendering as FOUR
// independent Action Stories. Every assertion below is about identity — which rows are one story,
// which are genuinely different stories, and that the two are never confused.
import { describe, it, expect } from 'vitest'
import { groupProposalsIntoStories, findStage, defaultStageOf, STAGE_ORDER } from './actionStory'
import { selectTemplate } from './templates/selectTemplate'
import decisions from '@/features/action-stories/__corpus__/normalized/dataset.json'

/** A queue row as `GET /v1/proposals` returns it. */
function row(storyCode, stage, overrides = {}) {
  return {
    proposal_id: `prop_${storyCode.toLowerCase().replace('.', '_')}_${stage}`,
    story_code: storyCode,
    stage,
    title: `${storyCode} headline`,
    status: 'pending',
    on_clock: false,
    ...overrides,
  }
}

const FOUR_STAGES = ['reason', 'analyze', 'decide', 'execute']

// ---- A: four stages -> ONE listing item ---------------------------------------------------------

describe('A. four stages of one Action Story produce ONE listing item', () => {
  it('collapses four stage rows into a single story', () => {
    const stories = groupProposalsIntoStories(FOUR_STAGES.map((s) => row('S10.1', s)))
    expect(stories).toHaveLength(1)
    expect(stories[0].story_code).toBe('S10.1')
  })

  it('collapses the real corpus queue from 105 stage rows to 26 Action Stories', () => {
    const stories = groupProposalsIntoStories(decisions)
    expect(decisions.length).toBe(105)
    expect(stories.length).toBe(26)
    expect(stories.reduce((n, s) => n + s.stages.length, 0)).toBe(105)
  })

  it('emits each story_code exactly once — no duplicate cards', () => {
    const codes = groupProposalsIntoStories(decisions).map((s) => s.story_code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

// ---- B: the story exposes its stages ------------------------------------------------------------

describe('B. an Action Story exposes its four stages', () => {
  it('lists reason, analyze, decide and execute', () => {
    const [story] = groupProposalsIntoStories(FOUR_STAGES.map((s) => row('S10.1', s)))
    expect(story.stageKeys).toEqual(FOUR_STAGES)
  })

  it('orders stages canonically regardless of arrival order', () => {
    const shuffled = ['execute', 'reason', 'decide', 'analyze'].map((s) => row('S10.1', s))
    const [story] = groupProposalsIntoStories(shuffled)
    expect(story.stageKeys).toEqual(FOUR_STAGES)
  })

  it('carries each stage own Decision Object id — stages are not merged into one proposal', () => {
    const [story] = groupProposalsIntoStories(FOUR_STAGES.map((s) => row('S10.1', s)))
    const ids = story.stages.map((s) => s.proposal_id)
    expect(new Set(ids).size).toBe(4)
  })

  it('handles the 5-stage story (S10.6 has a live stage) without a fixed stage count', () => {
    const [story] = groupProposalsIntoStories(groupInput('S10.6'))
    expect(story.stageKeys).toEqual(['reason', 'analyze', 'decide', 'execute', 'live'])
  })

  it('orders by the contract STAGES vocabulary, not a restated local list', () => {
    expect(STAGE_ORDER.slice(0, 4)).toEqual(FOUR_STAGES)
  })
})

function groupInput(code) {
  return decisions.filter((d) => d.story_code === code)
}

// ---- E: current stage / default stage -----------------------------------------------------------

describe('E. the current stage is identifiable within its story', () => {
  it('finds a specific stage by key', () => {
    const [story] = groupProposalsIntoStories(FOUR_STAGES.map((s) => row('S10.1', s)))
    expect(findStage(story, 'decide').proposal_id).toBe('prop_s10_1_decide')
    expect(findStage(story, 'analyze').stage).toBe('analyze')
  })

  it('returns null for a stage the story does not have', () => {
    const [story] = groupProposalsIntoStories([row('S10.1', 'reason')])
    expect(findStage(story, 'decide')).toBeNull()
    expect(findStage(null, 'decide')).toBeNull()
  })

  it('defaults to the first pending stage, else the first stage', () => {
    const settled = groupProposalsIntoStories([
      row('S10.1', 'reason', { status: 'approved' }),
      row('S10.1', 'analyze', { status: 'approved' }),
      row('S10.1', 'decide', { status: 'pending' }),
    ])
    expect(defaultStageOf(settled[0])).toBe('decide')

    const allDone = groupProposalsIntoStories([
      row('S10.1', 'reason', { status: 'approved' }),
      row('S10.1', 'decide', { status: 'dismissed' }),
    ])
    expect(defaultStageOf(allDone[0])).toBe('reason')
  })
})

// ---- G: genuinely different stories must NOT be grouped ------------------------------------------

describe('G. two genuinely different Action Stories are never grouped', () => {
  it('keeps S10.1..S10.4 as FOUR separate stories — they are not stages of a "Story 10"', () => {
    // This is the load-bearing assertion for the repository's actual ID semantics. S10.1 "Variance
    // bridge", S10.2 "Working capital", S10.3 "Account health" and S10.4 "Fee integrity" are four
    // different business domains, each declaring its own reason/analyze/decide/execute. The ".N" is
    // a sequence number within the S10 batch, NOT a stage index. Grouping them by a "10" prefix
    // would merge four unrelated stories into one.
    const rows = ['S10.1', 'S10.2', 'S10.3', 'S10.4'].flatMap((code) => FOUR_STAGES.map((s) => row(code, s)))
    const stories = groupProposalsIntoStories(rows)
    expect(stories.map((s) => s.story_code)).toEqual(['S10.1', 'S10.2', 'S10.3', 'S10.4'])
    for (const story of stories) expect(story.stageKeys).toEqual(FOUR_STAGES)
  })

  it('each real S10.x corpus story keeps its own distinct title', () => {
    const stories = groupProposalsIntoStories(decisions).filter((s) => s.story_code.startsWith('S10.'))
    const titles = stories.map((s) => s.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('never groups on a prefix — only on the whole story_code', () => {
    const stories = groupProposalsIntoStories([row('S9.1', 'reason'), row('S9.10', 'reason')])
    expect(stories).toHaveLength(2)
  })
})

// ---- F: template selection stays per-stage ------------------------------------------------------

describe('F. template selection still works independently for each stage of one story', () => {
  it('maps one story four stages to four different canonical templates', () => {
    const story = groupInput('S10.1')
    const byStage = Object.fromEntries(story.map((d) => [d.stage, selectTemplate(d)]))
    expect(byStage).toEqual({
      reason: 'reason.v1',
      analyze: 'analyze.compare.v1',
      decide: 'decide.slate.v1',
      execute: 'execute.bridge.v1',
    })
  })

  it('grouping changes no template decision — selection reads the Decision Object, not the story', () => {
    const before = decisions.map((d) => selectTemplate(d))
    const stories = groupProposalsIntoStories(decisions)
    const after = decisions.map((d) => selectTemplate(d))
    expect(after).toEqual(before)
    expect(stories.length).toBe(26) // grouping happened, selection unaffected
  })
})

// ---- robustness --------------------------------------------------------------------------------

describe('grouping is defensive about malformed input', () => {
  it('returns an empty list for non-arrays', () => {
    expect(groupProposalsIntoStories(null)).toEqual([])
    expect(groupProposalsIntoStories(undefined)).toEqual([])
    expect(groupProposalsIntoStories('nope')).toEqual([])
  })

  it('skips rows with no story_code rather than inventing a parent for them', () => {
    const stories = groupProposalsIntoStories([row('S10.1', 'reason'), { stage: 'decide' }, null])
    expect(stories).toHaveLength(1)
    expect(stories[0].stages).toHaveLength(1)
  })

  it('preserves first-appearance order of stories', () => {
    const stories = groupProposalsIntoStories([row('S9.3', 'reason'), row('S9.1', 'reason'), row('S9.3', 'decide')])
    expect(stories.map((s) => s.story_code)).toEqual(['S9.3', 'S9.1'])
  })
})
