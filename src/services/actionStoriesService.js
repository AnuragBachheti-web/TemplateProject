// The feature's data-access layer, rewritten around the Decision Object.
//
// BEFORE: three `import.meta.glob` calls loaded a workflow index, a story-specific manifest and a
// story-specific fixture off disk, and the URL's `:code/:stageKey` decided which layout rendered.
// AFTER: one API call returns a Decision Object, and `resolveTemplate` picks a canonical template
// from its business facts. There are no globs left in the runtime path — the 105 story manifests and
// fixtures now live under `__corpus__/` as reference evidence and are loaded only by tests.
//
// Everything downstream of this file is unchanged: `getStageView` hands StageRenderer an ordinary
// manifest and an ordinary data object, exactly the two arguments it has always taken.

import { getProposal, listProposals, isUsingMockTransport } from './decisionApi'
import { resolveTemplate } from '@/features/action-stories/templates/templateRegistry'
import { groupProposalsIntoStories, findStage } from '@/features/action-stories/actionStory'
import { ActionStoriesError, ERROR_CODES } from './actionStoriesErrors'

export { isUsingMockTransport }

/**
 * The raw queue — `GET /v1/proposals`. One row per Decision Object, i.e. one row PER STAGE.
 * Most callers want `getActionStories()` instead; this stays exported for anything that genuinely
 * needs stage-level rows.
 */
export function getProposalQueue(params = {}) {
  return listProposals(params)
}

/**
 * The Action Story listing: the queue, grouped by its parent `story_code`.
 *
 * This is the fix for one Action Story rendering as four independent cards. The API is unchanged —
 * it correctly returns one row per stage, because a stage has its own status and payload — and the
 * grouping happens here, using `story_code` and `stage`, which every row already carries. No new
 * contract field, no grouping service, no second store.
 *
 * @returns {Promise<import('@/features/action-stories/actionStory').ActionStory[]>}
 */
export async function getActionStories({ persona, limit = 200, signal } = {}) {
  // `limit` defaults high because the caller wants WHOLE stories: a page boundary that splits a
  // story's stages across two responses would show the same story twice, which is the exact bug
  // being fixed. A real deployment paginates by story on the server; noted as a contract dependency.
  const { items } = await listProposals({ persona, limit, signal })
  return groupProposalsIntoStories(items)
}

/**
 * Resolves one Action Story + stage to the Decision Object for that stage.
 *
 * `story_code` is the PARENT identity and `stage` selects the child, so this is a filtered queue
 * lookup over two fields both already in the contract. It is a separate round trip from
 * `getProposal` only because no single endpoint takes (story_code, stage) today — see the contract
 * dependency noted in the final report.
 *
 * @returns {Promise<string>} the `proposal_id` for that story's stage.
 * @throws {ActionStoriesError} NOT_FOUND when the story has no such stage.
 */
export async function resolveStageProposalId(storyCode, stageKey, { signal } = {}) {
  const { items } = await listProposals({ storyCode, limit: 50, signal })
  if (items.length === 0) {
    throw new ActionStoriesError(`No Action Story "${storyCode}"`, {
      code: ERROR_CODES.NOT_FOUND,
      userMessage: "We couldn't find that Action Story.",
      retryable: false,
    })
  }
  const [story] = groupProposalsIntoStories(items)
  const match = findStage(story, stageKey)
  if (!match) {
    throw new ActionStoriesError(`Action Story "${storyCode}" has no "${stageKey}" stage`, {
      code: ERROR_CODES.NOT_FOUND,
      userMessage: "That stage isn't part of this Action Story.",
      retryable: false,
    })
  }
  return { proposalId: match.proposal_id, story }
}

/**
 * Everything one stage needs to render: the Action Story it belongs to, the Decision Object at that
 * stage, the template selected from it, and the render-ready manifest.
 *
 * `decision` is passed to StageRenderer as the binding root, so every template binding is a path on
 * the Decision Object itself (`proposal.slate`, `guardrails.verdict`, `mode`) rather than the old
 * fixture envelope's `data.*`. That is the whole reason the slot vocabulary could collapse from 835
 * names to 43: the paths now mean something across proposals.
 *
 * @param {string} storyCode - the PARENT Action Story identity.
 * @param {string} stageKey - which of its stages to open.
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<{story: object, decision: object, templateId: string, manifest: object}>}
 * @throws {ActionStoriesError} NOT_FOUND / MALFORMED / NETWORK / ... via the shared taxonomy, and
 *   MALFORMED specifically when no canonical template covers the decision.
 */
export async function getStageView(storyCode, stageKey, { signal } = {}) {
  const { proposalId, story } = await resolveStageProposalId(storyCode, stageKey, { signal })
  const decision = await getProposal(proposalId, { signal })

  const resolved = resolveTemplate(decision)
  if (resolved === null) {
    // A deliberate, loud failure. The selector never guesses a template, so an uncovered
    // stage/action_type combination surfaces here rather than rendering a plausible wrong screen.
    // `live` is the known case today: it has no canonical template and, per the architecture
    // decision recorded in the final report, is not getting a speculative one.
    throw new ActionStoriesError(
      `No canonical template covers ${decision.action_type}/${decision.stage}/${decision.cardinality}`,
      {
        code: ERROR_CODES.MALFORMED,
        userMessage: "This proposal can't be displayed yet.",
        retryable: false,
      },
    )
  }

  // `story` travels with the view so StagePage can render StepTracker without a second fetch — the
  // parent identity and its sibling stages are already in hand from the lookup above.
  return { story, decision, templateId: resolved.templateId, manifest: resolved.manifest }
}
