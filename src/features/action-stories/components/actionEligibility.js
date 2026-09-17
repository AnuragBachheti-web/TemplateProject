import { resolveBinding } from '@/features/action-stories/manifests/resolveBinding';
import { evaluateCondition } from '@/features/action-stories/manifests/actionCondition';

/**
 * Resolves ONE template-declared action (manifests/validateManifest.js's `actions[]` schema)
 * against this stage's real data into everything the generic ActionBar needs to render and
 * dispatch it — a pure function, no React, no store, no knowledge of what the action's `id` means.
 *
 * This evaluates whatever business-eligibility rules a template DECLARES, and it knows nothing
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
 * `approve` no longer carries a `when` at all: its eligibility is derived at runtime by
 * contract/deriveEligibility.js, the single producer, and a template condition would be a second
 * one. What approve still declares here is its `disabledReasonBinding` — that is display COPY, not
 * a gate, and it is why an operator still reads "Full-launch exposure of $92.5K breaks the $75K
 * appetite set in Reason" rather than generic derived prose. `disabledReason` is therefore resolved
 * whether or not the declared condition disabled the action, because for approve there is no
 * declared condition to disable it.
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
  const disabledReason = resolveOptionalBinding(action?.disabledReasonBinding, fixture) ?? null;

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

/**
 * What a click on one action MEANS, as a value rather than as control flow inside a handler.
 *
 * Extracted because the branch it replaces only looked like a gate. It read
 * `!state.enabled || !verdict.allowed || anyPending` and then re-tested the narrower
 * `!state.enabled || anyPending` inside, so `!verdict.allowed` on its own fell straight through to
 * dispatch. Nothing shipped through that hole — the button was also `disabled` — but "the DOM
 * happened to disable it" is a rendering accident, not a barrier, and this is the same class of
 * defect as an eligibility check that never ran.
 *
 *   'ignore'   nothing to do: another action is in flight, the template disabled this one, or the
 *              verdict denies it and there is no payload for the operator to supply.
 *   'dialog'   open the dialog: it needs confirmation, or a reason/snooze/selection to be collected.
 *   'dispatch' run it now.
 *
 * @param {{state: object, verdict: {allowed: boolean}, spec: object|null, anyPending: boolean}} args
 * @returns {'ignore'|'dialog'|'dispatch'}
 */
export function resolveClickIntent({ state, verdict, spec, anyPending }) {
  if (anyPending || !state?.enabled) return 'ignore';

  // The one thing the verdict does NOT veto: opening a dialog whose whole purpose is to collect the
  // payload the verdict is complaining about. A required reason, a snooze time or a selection is
  // something the operator is about to provide, and a dead button gives them no way to.
  const needsPayload = Boolean(spec?.requiresSelection || spec?.reasonRequired || spec?.requiresSnoozeUntil);
  if (!verdict?.allowed && !needsPayload) return 'ignore';

  return state.confirmRequired || state.reasonEnabled || needsPayload ? 'dialog' : 'dispatch';
}

