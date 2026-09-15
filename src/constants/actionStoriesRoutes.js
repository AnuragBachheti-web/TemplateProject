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
 * One Action Story, opened AT a stage. Two segments, not one: `storyCode` is the PARENT identity
 * and `stageKey` selects which of that story's Decision Objects to render. All four of
 * `/action-stories/S10.1/{reason,analyze,decide,execute}` are the same Action Story.
 *
 * The proposal id is deliberately NOT in the URL. It identifies one stage's Decision Object, so a
 * proposal-keyed route made every stage a top-level entity and dissolved the story as an identity —
 * which is exactly how one Action Story came to render as four independent listing cards.
 */
export const actionStoryPath = (storyCode, stageKey) => `${ACTION_STORIES_ROOT}/${storyCode}/${stageKey}`;

/** True when `pathname` is any Action Stories screen (the index or a workflow/stage). */
export const isActionStoriesPath = (pathname) =>
  pathname === ACTION_STORIES_ROOT || pathname.startsWith(`${ACTION_STORIES_ROOT}/`);

/** Route path patterns for the react-router-dom <Route> definitions in App.jsx. */
export const ACTION_STORIES_ROUTES = {
  index: ACTION_STORIES_ROOT,
  stage: `${ACTION_STORIES_ROOT}/:storyCode/:stageKey`,
};
