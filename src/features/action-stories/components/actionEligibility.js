import { resolveBinding } from '@/features/action-stories/manifests/resolveBinding';
import { evaluateCondition } from '@/features/action-stories/manifests/actionCondition';

/**
 * Resolves ONE template-declared action (manifests/validateManifest.js's `actions[]` schema)
 * against this stage's real data into everything the generic ActionBar needs to render and
 * dispatch it — a pure function, no React, no store, no knowledge of what the action's `id` means.
 *
 * This is the sole place business-eligibility rules get evaluated, and it knows nothing
 * business-specific itself: an action either carries a `when` condition (evaluated generically by
 * actionCondition.js's evaluateCondition) or it doesn't (always enabled). The exact rule this
 * replaces — "a decide/execute stage's Approve is blocked when `guardrail_blocked` is true or
 * `guardrail_can_approve` is false, and absence of either field is not itself a block" — is no
 * longer special-cased here; it's expressed entirely as manifest data (see
 * extraction/generateManifests.js's buildActionsForStage, which emits exactly that `when` shape for
 * every real decide/execute stage using `ne` — the operator whose own "a missing value satisfies
 * `ne`" semantics is what makes the fail-open-when-absent behavior fall out for free, without this
 * file (or any other generic code) knowing "guardrail" is a business concept).
 *
 * @param {object} action - one entry from `manifest.actions`.
 * @param {object} fixture - this stage's raw fixture, resolved through exactly like a block binding.
 * @returns {{
 *   id: string, label: string, kind: 'primary'|'secondary'|'destructive',
 *   enabled: boolean, disabledReason: string|null,
 *   loadingLabel: string|null,
 *   confirmRequired: boolean, confirmTitle: string, confirmDescription: string|null,
 *   reasonEnabled: boolean, reasonRequired: boolean, reasonLabel: string, reasonMinLength: number,
 *   actionType: string,
 * }}
 */
export function resolveActionState(action, fixture) {
  const enabled = action?.when === undefined || evaluateCondition(action.when, fixture);
  const label = resolveOptionalBinding(action?.labelBinding, fixture) ?? action?.label ?? 'Action';
  const disabledReason = enabled ? null : resolveOptionalBinding(action?.disabledReasonBinding, fixture) ?? null;

  return {
    id: action?.id,
    label,
    kind: action?.kind ?? 'secondary',
    enabled,
    disabledReason,
    loadingLabel: isNonEmptyString(action?.loadingLabel) ? action.loadingLabel : null,
    confirmRequired: Boolean(action?.confirm?.required),
    confirmTitle: isNonEmptyString(action?.confirm?.title) ? action.confirm.title : `${label}?`,
    confirmDescription: typeof action?.confirm?.description === 'string' ? action.confirm.description : null,
    reasonEnabled: Boolean(action?.reason),
    reasonRequired: Boolean(action?.reason?.required),
    reasonLabel: isNonEmptyString(action?.reason?.label) ? action.reason.label : 'Reason',
    reasonMinLength: typeof action?.reason?.minLength === 'number' && action.reason.minLength > 0 ? action.reason.minLength : 0,
    // The dispatcher's own registry key (actionStoriesMutations.js's ACTION_HANDLERS) — a template
    // may declare a backend operation type distinct from its own `id` (e.g. two differently-labeled
    // UI actions, "Approve" and "Approve & notify", both dispatching the same "confirm" operation);
    // defaults to the action's own `id` when the manifest doesn't set one.
    actionType: isNonEmptyString(action?.action) ? action.action : action?.id,
  };
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/** A binding that resolves to a non-empty string, or `undefined` (never a resolved non-string/blank value). */
function resolveOptionalBinding(binding, fixture) {
  if (!isNonEmptyString(binding)) return undefined;
  const value = resolveBinding(binding, fixture);
  return isNonEmptyString(value) ? value : undefined;
}
