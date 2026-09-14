import { useEffect, useRef, useState } from 'react';
import { useActionStoriesStore } from '@/store/useActionStoriesStore';
import { resolveActionState } from './actionEligibility';
import ConfirmDialog from '../ui/ConfirmDialog';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';
import Alert from '../ui/Alert';

/**
 * A genuinely generic, template-driven action bar. Renders whatever `actions[]` this stage's
 * manifest declares — zero, one, or many, in any combination of label/kind/eligibility/
 * confirmation/reason requirements (validateManifest.js's `actions[]` schema) — through ONE shared
 * component. Nothing in this file knows what "approve", "decline", or any other action `id`/`action`
 * string MEANS; each one is fully described by its own manifest entry and resolved against this
 * stage's real data by actionEligibility.js's resolveActionState (label/enabled/disabledReason/
 * confirmation/reason — a pure function, no React, no business vocabulary).
 *
 * `actions` absent or `[]` renders nothing at all — an action is a template capability a stage
 * either declares or doesn't declare, never inferred from `stageKey` (this replaces the previous
 * hardcoded `stageKey === 'decide' || stageKey === 'execute'` check — see git history /
 * AUDIT_REPORT.md's own P0 callout on this).
 *
 * Each action click -> (confirmation and/or reason, if the action declares either) -> the generic
 * store's `runAction`, which dispatches through services/actionStoriesMutations.js's own
 * ACTION_HANDLERS registry — see that file for exactly what "real" means today (no live backend
 * exists yet; genuinely async, genuinely persisted, genuinely failable).
 *
 * Multiple simultaneous actions: each has its own independent done/pending/error state (the store
 * is keyed by `${code}/${stageKey}/${actionId}`), but while ANY action on this bar is running, every
 * OTHER action's button disables too — running two consequential actions on the same stage at once
 * is never a sensible UI state, even though the underlying store has no trouble tracking both.
 */
export default function StageActionBar({ code, stageKey, actions, fixture }) {
  const runAction = useActionStoriesStore((s) => s.runAction);
  // Subscribed to the raw state SLICES, not the store's `isActionDone`/`isActionPending`/
  // `getActionError` helper methods — those method references never change identity, so selecting
  // them (`useStore((s) => s.isActionDone)`) would never re-render this component when a
  // completion/pending/error actually happens. Subscribing to the objects themselves (new
  // references on every `set()`) is what makes each render below see fresh values; the three small
  // lookups just read out of them per this render's own `actions` list, not via a hook (this runs
  // inside `.map()`, where a per-item hook call would violate the rules of hooks).
  const completedActions = useActionStoriesStore((s) => s.completedActions);
  const pendingActions = useActionStoriesStore((s) => s.pendingActions);
  const actionErrors = useActionStoriesStore((s) => s.actionErrors);
  const { notify } = useToast();

  const keyFor = (actionId) => `${code}/${stageKey}/${actionId}`;
  const isActionDone = (actionId) => Boolean(completedActions[keyFor(actionId)]);
  const isActionPending = (actionId) => Boolean(pendingActions[keyFor(actionId)]);
  const getActionError = (actionId) => actionErrors[keyFor(actionId)] ?? null;

  const [openActionId, setOpenActionId] = useState(null);
  const [reasonDraft, setReasonDraft] = useState('');

  const hasActions = Array.isArray(actions) && actions.length > 0;
  const anyPending = hasActions && actions.some((a) => isActionPending(a.id));
  const openDef = hasActions ? actions.find((a) => a.id === openActionId) || null : null;
  const openState = openDef ? resolveActionState(openDef, fixture) : null;

  // Closes the open dialog and raises a toast on the falling edge of the OPEN action's own pending
  // state — the exact moment the mutation this dialog was gating just settled (done, or failed) —
  // never merely "no longer pending", which a STALE error from a previous failed attempt on this
  // same action would also satisfy.
  const openPendingNow = openDef ? isActionPending(openDef.id) : false;
  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !openPendingNow && openDef) {
      setOpenActionId(null);
      setReasonDraft('');
      if (isActionDone(openDef.id)) {
        notify(`${openState.label} completed for ${code}.`, { tone: 'success' });
      } else {
        const err = getActionError(openDef.id);
        if (err) notify(err.userMessage, { tone: 'critical' });
      }
    }
    wasPendingRef.current = openPendingNow;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPendingNow, openDef, code, notify]);

  if (!hasActions) return null;

  const reasonInvalid = Boolean(openState?.reasonRequired) && reasonDraft.trim().length < openState.reasonMinLength;

  function handleClick(actionDef, state) {
    if (!state.enabled || isActionDone(actionDef.id) || anyPending) return;
    if (state.confirmRequired || state.reasonEnabled) {
      setOpenActionId(actionDef.id);
      setReasonDraft('');
    } else {
      runAction(code, stageKey, actionDef.id, { action: state.actionType });
    }
  }

  function handleConfirm() {
    if (!openDef || !openState || reasonInvalid) return;
    runAction(code, stageKey, openDef.id, { action: openState.actionType, reason: reasonDraft.trim() || undefined });
  }

  function closeDialog() {
    setOpenActionId(null);
    setReasonDraft('');
  }

  return (
    <div className="mx-auto flex w-full max-w-page flex-wrap items-center gap-3 border-t border-rf-border-subtle bg-rf-surface-canvas px-6 py-3.5">
      {actions.map((actionDef) => {
        const state = resolveActionState(actionDef, fixture);
        const done = isActionDone(actionDef.id);
        const pending = isActionPending(actionDef.id);
        const error = getActionError(actionDef.id);
        const blocked = !state.enabled && !done; // done always wins over a stale ineligibility signal

        const buttonVariant = done || blocked ? 'secondary' : state.kind === 'destructive' ? 'destructive' : state.kind === 'primary' ? 'primary' : 'secondary';
        const buttonLabel = done ? 'Done' : blocked ? 'Unavailable' : pending ? state.loadingLabel || `${state.label}…` : error ? `Retry ${state.label}` : state.label;

        return (
          <div key={actionDef.id} className="flex items-center gap-2">
            {done && (
              <Alert tone="success" compact>
                {state.label} confirmed
              </Alert>
            )}
            {error && !done && (
              <Alert tone="critical" compact>
                {error.userMessage}
              </Alert>
            )}
            {blocked && !error && (
              <Alert tone="warning" compact>
                {state.disabledReason || `${state.label} isn't available for this proposal yet.`}
              </Alert>
            )}
            <Button
              variant={buttonVariant}
              disabled={done || pending || blocked || (anyPending && !pending)}
              loading={pending}
              aria-disabled={blocked || undefined}
              onClick={() => handleClick(actionDef, state)}
            >
              {buttonLabel}
            </Button>
          </div>
        );
      })}

      {openDef && openState && (
        <ConfirmDialog
          open
          title={openState.confirmTitle}
          description={openState.confirmDescription}
          confirmLabel={openState.label}
          cancelLabel="Cancel"
          tone={openDef.kind === 'destructive' ? 'destructive' : 'default'}
          onConfirm={handleConfirm}
          onCancel={closeDialog}
          loading={openPendingNow}
          confirmDisabled={reasonInvalid}
        >
          {openState.reasonEnabled && (
            <label className="mt-4 block text-[12.5px] font-medium text-rf-text-secondary">
              {openState.reasonLabel}
              {openState.reasonRequired ? ' (required)' : ' (optional)'}
              <textarea
                value={reasonDraft}
                onChange={(event) => setReasonDraft(event.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-2.5 text-[13px] text-rf-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring"
              />
              {reasonInvalid && (
                <span className="mt-1 block text-[11.5px] text-rose-600 dark:text-rose-400">
                  At least {openState.reasonMinLength} characters required.
                </span>
              )}
            </label>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
