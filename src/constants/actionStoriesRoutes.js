/**
 * The Action Stories URL vocabulary — mirrors workspaceRoutes.js's shape from the app this
 * project merges into: a root path, small path-builder helpers, and an isXPath guard, all in one
 * place so a URL shape can change without touching every call site.
 *
 * Interaction state — which Action Story, and which of its stages — lives in the URL, never only in
 * a component or the store. useActionStoriesStore holds the Decision Object itself (server state)
 * but not "which story is active"; StagePage reads `storyCode`/`stageKey` straight from
 * useParams(), so a refresh or a back/forward navigation always lands on exactly the story and
 * stage the URL names, with the same parent identity.
 */
export const ACTION_STORIES_ROOT = '/action-stories';

/** The workflow index — Shell's default landing, redirects to the first workflow's first stage. */
export const actionStoriesIndexPath = () => ACTION_STORIES_ROOT;

/**
 * One Action Story, opened AT a stage, AT a proposal. `storyCode` is the PARENT identity, `stageKey`
 * names the step, and `proposalId` says WHICH Decision Object — all four of
 * `/action-stories/S10.1/{reason,analyze,decide,execute}/...` are still the same Action Story, so
 * the story survives as an identity while the proposal becomes explicitly addressable.
 *
 * WHY THE ID IS NOW HERE. It was left out on the reasoning that a proposal-keyed route made every
 * stage a top-level entity and dissolved the story — which is what turned one Action Story into four
 * independent listing cards. The story is what the FIRST TWO segments carry, and keeping them is
 * what preserves it; the third only disambiguates. Without it, lookup was (storyCode, stageKey) ->
 * first match, and a second proposal at one (story, stage) was permanently unreachable.
 *
 * `proposalId` is optional: omitting it builds the old two-segment path, which still resolves
 * through StageRedirect. That is what keeps every existing link and bookmark working (C4).
 */
export const actionStoryPath = (storyCode, stageKey, proposalId) =>
  proposalId
    ? `${ACTION_STORIES_ROOT}/${storyCode}/${stageKey}/${proposalId}`
    : `${ACTION_STORIES_ROOT}/${storyCode}/${stageKey}`;

/** True when `pathname` is any Action Stories screen (the index or a workflow/stage). */
export const isActionStoriesPath = (pathname) =>
  pathname === ACTION_STORIES_ROOT || pathname.startsWith(`${ACTION_STORIES_ROOT}/`);

/** Route path patterns for the react-router-dom <Route> definitions in App.jsx. */
export const ACTION_STORIES_ROUTES = {
  index: ACTION_STORIES_ROOT,
  /** The canonical route. Every rendered stage screen is at this shape. */
  stage: `${ACTION_STORIES_ROOT}/:storyCode/:stageKey/:proposalId`,
  /** The pre-proposalId shape. Resolves the id once, then redirects to `stage`. */
  stageLegacy: `${ACTION_STORIES_ROOT}/:storyCode/:stageKey`,
};
