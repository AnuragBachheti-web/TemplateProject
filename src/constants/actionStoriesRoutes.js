/**
 * The Action Stories URL vocabulary — mirrors workspaceRoutes.js's shape from the app this
 * project merges into: a root path, small path-builder helpers, and an isXPath guard, all in one
 * place so a URL shape can change without touching every call site.
 *
 * Interaction state — which workflow, which stage — lives in the URL, never only in a component
 * or the store. useActionStoriesStore does not keep its own copy of "which workflow is active";
 * StagePage reads `code`/`stageKey` straight from useParams(), so a refresh or a back/forward
 * navigation always lands on exactly the screen the URL names.
 */
export const ACTION_STORIES_ROOT = '/action-stories';

/** The workflow index — Shell's default landing, redirects to the first workflow's first stage. */
export const actionStoriesIndexPath = () => ACTION_STORIES_ROOT;

/** Internal workflow code + stage key -> that stage's URL. */
export const actionStoryPath = (code, stageKey) =>
  `${ACTION_STORIES_ROOT}/${code}/${stageKey}`;

/** True when `pathname` is any Action Stories screen (the index or a workflow/stage). */
export const isActionStoriesPath = (pathname) =>
  pathname === ACTION_STORIES_ROOT || pathname.startsWith(`${ACTION_STORIES_ROOT}/`);

/** Route path patterns for the react-router-dom <Route> definitions in App.jsx. */
export const ACTION_STORIES_ROUTES = {
  index: ACTION_STORIES_ROOT,
  stage: `${ACTION_STORIES_ROOT}/:code/:stageKey`,
};
