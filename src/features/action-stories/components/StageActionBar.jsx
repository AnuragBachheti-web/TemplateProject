import { useState } from 'react';
import { useActionStoriesStore } from '@/store/useActionStoriesStore';
import { resolveActionState } from './actionEligibility';
import { checkOperatorAction, getOperatorAction } from '@/features/action-stories/contract/actionTypes';
import { isTerminal } from '@/features/action-stories/contract/statusLifecycle';
import ConfirmDialog from '../ui/ConfirmDialog';
import Button from '../ui/Button';
import SnoozeUntilField from '../ui/SnoozeUntilField';
import { localInputValueToIso } from '../ui/snoozeTime';
import { useToast } from '../ui/Toast';
import Alert from '../ui/Alert';

/**
 * The generic, template-driven action bar — unchanged in design, retargeted at the Decision Object.
 *
 * It still contains no action id, no `if (stage === 'decide')`, and no knowledge of what "approve"
 * means: it renders whatever `manifest.actions[]` declares, resolved against the Decision Object by
 * the existing `resolveActionState`. What changed:
 *
 *   - Eligibility now reads `eligibility.<action>.allowed` through the template's own `when`
 *     conditions, which use `exists` + `eq true` so a MISSING entry disables rather than enables.
 *     The old corpus expressed the opposite (`ne`, where absence satisfied the condition), which is
 *     why 40 of 52 actions were unconditionally enabled.
 *   - Every action is additionally run through `checkOperatorAction` — the same pure function the
 *     store's dispatch boundary and the server both use — so payload-level rules (a non-empty
 *     selection, a future snooze time, a legal status transition) gate the button too, rather than
 *     only failing after the click.
 *   - A terminal proposal (approved/dismissed) renders no actions at all.
 *
 * Multiple simultaneous actions each keep independent pending/error state, but while ANY action is
 * running every other button disables — running two consequential mutations against one proposal at
 * once is never a sensible state.
 */
export default function StageActionBar({ actions }) {
  const decision = useActionStoriesStore((s) => s.decision);
  const runAction = useActionStoriesStore((s) => s.runAction);
  const selection = useActionStoriesStore((s) => s.selection);
  // Subscribed to the raw slices, not the store's getter methods — a method reference never changes
  // identity, so selecting one would never re-render this component when a pending/error actually
  // changes. The small lookups below read out of these per render, not via a hook (this runs inside
  // `.map()`, where a per-item hook call would violate the rules of hooks).
  const pendingActions = useActionStoriesStore((s) => s.pendingActions);
  const actionErrors = useActionStoriesStore((s) => s.actionErrors);
  const { notify } = useToast();

  const [openActionId, setOpenActionId] = useState(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [snoozeDraft, setSnoozeDraft] = useState('');

  const isPending = (id) => Boolean(pendingActions[id]);
  const getError = (id) => actionErrors[id] ?? null;

  const hasActions = Array.isArray(actions) && actions.length > 0 && decision !== null && !isTerminal(decision?.status);
  const anyPending = hasActions && actions.some((a) => isPending(a.id));
  const openDef = hasActions ? actions.find((a) => a.id === openActionId) ?? null : null;
  const openSpec = openDef ? getOperatorAction(openDef.id) : null;
  const openState = openDef ? resolveActionState(openDef, decision) : null;

  const snoozeIso = localInputValueToIso(snoozeDraft);
  // The dialog's own validity uses the SAME contract function the dispatch gate and the server use,
  // so "the button is enabled" and "the request will be accepted" can never disagree.
  const openVerdict = openDef
    ? checkOperatorAction(openDef.id, decision, {
        reason: reasonDraft,
        selection,
        snooze_until: snoozeIso,
      })
    : null;

  const openPendingNow = openDef ? isPending(openDef.id) : false;

  if (!hasActions) return null;

  function handleClick(actionDef, state, verdict) {
    if (!state.enabled || !verdict.allowed || anyPending) {
      // A dialog still opens for an action whose only obstacle is unsupplied payload — a required
      // reason, a snooze time, a selection. Those are things the operator is about to provide; a
      // disabled button would give them no way to.
      if (!state.enabled || anyPending) return;
    }
    const spec = getOperatorAction(actionDef.id);
    if (state.confirmRequired || state.reasonEnabled || spec?.requiresSnoozeUntil) {
      setOpenActionId(actionDef.id);
      setReasonDraft('');
      setSnoozeDraft('');
    } else {
      settle(actionDef.id, { selection }, state.label);
    }
  }

  /**
   * Settling is driven by the action's own resolution, not by watching its pending flag in an
   * effect. `runAction` resolves with the updated Decision Object on success and `undefined` on
   * failure (the store records the error), so the dialog closes and the toast fires exactly once,
   * at exactly the right moment — and a stale error from a previous attempt can no longer be
   * mistaken for this attempt settling.
   */
  async function settle(actionId, payload, label) {
    const updated = await runAction(actionId, payload);
    if (updated) {
      setOpenActionId(null);
      setReasonDraft('');
      setSnoozeDraft('');
      notify(`${label} completed.`, { tone: 'success' });
    } else {
      const err = getError(actionId);
      if (err) notify(err.userMessage, { tone: 'critical' });
    }
  }

  function handleConfirm() {
    if (!openDef || !openVerdict?.allowed) return;
    settle(
      openDef.id,
      { reason: reasonDraft.trim() || undefined, selection, snoozeUntil: snoozeIso ?? undefined },
      openState.label,
    );
  }

  function closeDialog() {
    setOpenActionId(null);
    setReasonDraft('');
    setSnoozeDraft('');
  }

  return (
    <div className="sticky bottom-0 z-20 mx-auto flex w-full max-w-page flex-wrap items-center gap-3 border-t border-rf-border-subtle bg-rf-surface-canvas px-6 py-3.5">
      {actions.map((actionDef) => {
        const state = resolveActionState(actionDef, decision);
        const spec = getOperatorAction(actionDef.id);
        const pending = isPending(actionDef.id);
        const error = getError(actionDef.id);

        // Two different reasons a button can be unusable, and they are not the same thing:
        //  - `blocked`: the backend says this operator may not do this (eligibility) — show why.
        //  - payload-incomplete: the operator simply has not selected/typed anything yet — let them
        //    click through to the dialog that collects it.
        const blocked = !state.enabled;
        const verdict = checkOperatorAction(actionDef.id, decision, { reason: reasonDraft, selection });
        const needsPayload = !blocked && !verdict.allowed && Boolean(spec?.requiresSelection || spec?.reasonRequired || spec?.requiresSnoozeUntil);
        const hardBlocked = !blocked && !verdict.allowed && !needsPayload;

        const unusable = blocked || hardBlocked;
        const buttonVariant = unusable ? 'secondary' : state.kind === 'destructive' ? 'destructive' : state.kind === 'primary' ? 'primary' : 'secondary';
        const buttonLabel = unusable
          ? 'Unavailable'
          : pending
            ? state.loadingLabel || `${state.label}…`
            : error
              ? `Retry ${state.label}`
              : state.label;

        return (
          <div key={actionDef.id} className="flex items-center gap-2">
            {error && <Alert tone="critical" compact>{error.userMessage}</Alert>}
            {unusable && !error && (
              <Alert tone="warning" compact>
                {state.disabledReason || verdict.reason || `${state.label} isn't available for this proposal.`}
              </Alert>
            )}
            <Button
              variant={buttonVariant}
              disabled={unusable || pending || (anyPending && !pending)}
              loading={pending}
              aria-disabled={unusable || undefined}
              onClick={() => handleClick(actionDef, state, verdict)}
            >
              {buttonLabel}
            </Button>
            {/* Approve-selected is the only action whose control needs a live count — an operator
                must know what "selected" currently means before confirming it. */}
            {spec?.requiresSelection && !unusable && (
              <span className="font-mono text-[11px] text-rf-text-tertiary">{selection.length} selected</span>
            )}
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
          confirmDisabled={!openVerdict?.allowed}
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
            </label>
          )}

          {openSpec?.requiresSnoozeUntil && (
            <SnoozeUntilField value={snoozeDraft} onChange={setSnoozeDraft} error={null} />
          )}

          {openSpec?.requiresSelection && (
            <p className="mt-4 text-[12.5px] text-rf-text-secondary">
              {selection.length} item{selection.length === 1 ? '' : 's'} selected.
            </p>
          )}

          {/* One message, sourced from the one contract function — never a second, differently-worded
              copy of the same rule written inline for the dialog. */}
          {!openVerdict?.allowed && openVerdict?.reason && (
            <p className="mt-2 text-[11.5px] text-rose-600 dark:text-rose-400">{openVerdict.reason}</p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
