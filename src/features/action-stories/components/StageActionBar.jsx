import { useState } from 'react';
import { Link } from 'react-router-dom';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';
import { STAGE_ORDER } from '@/features/action-stories/actionStory';
import { useActionStoriesStore } from '@/store/useActionStoriesStore';
import { resolveActionState, resolveClickIntent } from './actionEligibility';
import { checkOperatorAction, getOperatorAction } from '@/features/action-stories/contract/actionTypes';
import { DISMISS_REASONS } from '@/features/action-stories/contract/decisionObject';
import { DERIVED_ELIGIBILITY } from '@/features/action-stories/contract/deriveEligibility';
import { isTerminal } from '@/features/action-stories/contract/statusLifecycle';
import ConfirmDialog from '../ui/ConfirmDialog';
import Button from '../ui/Button';
import SnoozeUntilField from '../ui/SnoozeUntilField';
import { localInputValueToIso } from '../ui/snoozeTime';
import { useToast } from '../ui/Toast';
import Alert from '../ui/Alert';

import { typeRole } from '../blocks/typeRole';
import { glyph } from '../blocks/glyphSize';
/**
 * The generic, template-driven action bar — unchanged in design, retargeted at the Decision Object.
 *
 * It still contains no action id, no `if (stage === 'decide')`, and no knowledge of what "approve"
 * means: it renders whatever `manifest.actions[]` declares, resolved against the Decision Object by
 * the existing `resolveActionState`. What changed:
 *
 *   - Eligibility for five of the six actions reads `eligibility.<action>.allowed` through the
 *     template's own `when` conditions, which use `exists` + `eq true` so a MISSING entry disables
 *     rather than enables. The old corpus expressed the opposite (`ne`, where absence satisfied the
 *     condition), which is why 40 of 52 actions were unconditionally enabled.
 *   - `approve` is the sixth and reads no template condition at all: it is DERIVED by
 *     contract/deriveEligibility.js and reaches this component through `checkOperatorAction` below,
 *     like every other payload-level rule. Its template entry keeps only `disabledReasonBinding`,
 *     which is the operator-facing copy, not the gate.
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
/**
 * The stage this one leads to, or null on the last stage of this story.
 *
 * Read from the STORY's own stage list intersected with the contract's canonical order, never from
 * a hardcoded reason->analyze->decide->execute chain: S10.6 carries a `live` stage and several
 * stories do not carry all four, so "the next one" is a fact about this story, not about the
 * vocabulary. A story whose outline failed to load has no next stage, and the bar correctly offers
 * no forward action rather than guessing one.
 */
function nextStageOf(story, stage) {
  if (!story) return null;
  const present = new Set(story.stages.map((s) => s.stage));
  const from = STAGE_ORDER.indexOf(stage);
  if (from < 0) return null;
  for (let i = from + 1; i < STAGE_ORDER.length; i += 1) {
    if (present.has(STAGE_ORDER[i])) return STAGE_ORDER[i];
  }
  return null;
}

/**
 * @param {string} [stageState] - the stage's own one-line state (`status_note`). Phase 5C moved
 *   this here from the rail's `stage_status` slot (R60): the reference prints it once, in the
 *   footer, and a rail copy was a second rendering of one fact — the same defect Phase 4 Part 2
 *   deleted `decision_mode` for.
 * @param {object} [story] - this proposal's own story outline, for the forward action's target.
 */
export default function StageActionBar({ actions, stageState, stage, storyCode, story }) {
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
  // The coded dismissal reason. Empty until chosen, and the contract denies on empty — so the
  // operator picks rather than the UI defaulting them into a code they did not mean.
  const [reasonCodeDraft, setReasonCodeDraft] = useState('');

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
        reason_code: reasonCodeDraft,
        selection,
        snooze_until: snoozeIso,
      })
    : null;

  const openPendingNow = openDef ? isPending(openDef.id) : false;

  // PHASE 5C: no longer `return null` for "this stage has no eligible actions". The bar used to
  // disappear entirely on any such stage — which is most reason and analyze screens — taking the
  // stage's own state line and the route forward with it. Every reference stage screen ends in this
  // bar (S10.1-1-reason.dc.html:392), so what is conditional is the ACTION BUTTONS, not the bar.
  //
  // A LOCKED PROPOSAL IS THE ONE EXCEPTION, and it still renders nothing. locked.v1 is a teaser: it
  // withholds the slate, the figures and the item count, and a footer offering "Continue to
  // Analyze" would tell an unentitled viewer that a next stage exists and hand them the route to
  // it. That is an entitlement decision, not a layout one, so the pre-5C guarantee is kept exactly
  // rather than narrowed to "no buttons".
  if (decision?.entitlement === 'locked') return null;

  const next = nextStageOf(story, stage);
  const nextProposalId = next ? story?.stages.find((s) => s.stage === next)?.proposal_id : null;

  function handleClick(actionDef, state, verdict) {
    const spec = getOperatorAction(actionDef.id);
    const intent = resolveClickIntent({ state, verdict, spec, anyPending });
    if (intent === 'ignore') return;
    if (intent === 'dialog') {
      setOpenActionId(actionDef.id);
      setReasonDraft('');
      setSnoozeDraft('');
      setReasonCodeDraft('');
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
      setReasonCodeDraft('');
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
      {
        reason: reasonDraft.trim() || undefined,
        reasonCode: reasonCodeDraft || undefined,
        selection,
        snoozeUntil: snoozeIso ?? undefined,
      },
      openState.label,
    );
  }

  function closeDialog() {
    setOpenActionId(null);
    setReasonDraft('');
    setSnoozeDraft('');
    setReasonCodeDraft('');
  }

  return (
    // `shrink-0`, not `sticky`: the bar is a non-shrinking sibling of the scroll regions inside the
    // fixed-height pane, so it occupies its own track and CANNOT overlap content (invariant I7). A
    // sticky or fixed bar would float above the last block of a region and need padding to
    // compensate; a sibling needs nothing, which is the stronger guarantee. Matches the reference's
    // own `flex:0 0 auto` footer (S10.1-1-reason.dc.html:392).
    <div
      data-shell-part="actionbar"
      className="z-20 mx-auto flex w-full max-w-page shrink-0 flex-wrap items-center gap-3 border-t border-rf-border-subtle bg-rf-surface-canvas px-6 py-3.5"
    >
      {/* The stage's own state, on the left, exactly as the reference prints it. Rendered even when
          the proposal states none — an empty band would collapse the bar's left half and make the
          forward action look unanchored — falling back to the stage's own name, which is a fact the
          object always carries rather than invented copy. */}
      <span
        data-stage-state
        {...typeRole('label', 'min-w-0 truncate text-rf-text-secondary')}
      >
        {typeof stageState === 'string' && stageState.trim() !== '' ? stageState : stage}
      </span>

      {/* The buttons are what is conditional — a terminal proposal, or a stage the template gives
          no actions, renders the bar with its state line and its forward action and no buttons. */}
      {(hasActions ? actions : []).map((actionDef) => {
        const state = resolveActionState(actionDef, decision);
        const spec = getOperatorAction(actionDef.id);
        const pending = isPending(actionDef.id);
        const error = getError(actionDef.id);

        // Two different reasons a button can be unusable, and they are not the same thing:
        //  - `blocked`: the backend says this operator may not do this (eligibility) — show why.
        //  - payload-incomplete: the operator simply has not selected/typed anything yet — let them
        //    click through to the dialog that collects it.
        // For a DERIVED action the proposal-level answer is available on its own, without a payload
        // — that is what makes the producer pure. Asking it separately is what distinguishes "this
        // action does not apply to this proposal" from "the operator has not ticked anything yet".
        // Without it, `approve_selected` on a one-item proposal looked like the latter and rendered a
        // live button, because the template condition that used to hide it is gone.
        const derive = DERIVED_ELIGIBILITY[actionDef.id];
        const proposalLevel = derive ? derive(decision) : null;
        const blocked = !state.enabled || (proposalLevel !== null && !proposalLevel.allowed);
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
                {state.disabledReason || proposalLevel?.reason || verdict.reason || `${state.label} isn't available for this proposal.`}
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
              <span {...typeRole('figure', 'text-rf-text-tertiary')}>{selection.length} selected</span>
            )}
          </div>
        );
      })}

      {/* The route forward, on the right. Absent on the last stage of the story — the reference's
          execute footer shows a completion chip there, never a "Continue to" (S10.1-4-execute:398).
          This is navigation between stages of one proposal, not an operator ACTION: it mutates
          nothing, so it is a link and it is never gated by eligibility. */}
      {next !== null && (
        <Link
          data-stage-forward
          to={actionStoryPath(storyCode, next, nextProposalId)}
          {...typeRole('heading', 'ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-rf-text-primary px-4 text-rf-surface-canvas transition-colors hover:bg-rf-brand-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring')}
        >
          Continue to <span className="capitalize">{next}</span>
          <i className={`fa-solid fa-arrow-right ${glyph(11)}`} aria-hidden="true" />
        </Link>
      )}

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
          {/* The coded reason, for the one action that has to be filterable afterwards. Rendered
              from the action's own contract spec, so this component still knows nothing about what
              "dismiss" means — it renders a picker because the spec says a code is required. */}
          {openSpec?.requiresReasonCode && (
            <label {...typeRole('body', 'mt-4 block text-rf-text-secondary')}>
              Reason code (required)
              <select
                value={reasonCodeDraft}
                onChange={(event) => setReasonCodeDraft(event.target.value)}
                {...typeRole('body', 'mt-1.5 w-full rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-2.5 text-rf-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring')}
              >
                <option value="">Choose one…</option>
                {DISMISS_REASONS.map((code) => (
                  <option key={code} value={code}>
                    {code.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
          )}

          {openState.reasonEnabled && (
            <label {...typeRole('body', 'mt-4 block text-rf-text-secondary')}>
              {openState.reasonLabel}
              {openState.reasonRequired ? ' (required)' : ' (optional)'}
              <textarea
                value={reasonDraft}
                onChange={(event) => setReasonDraft(event.target.value)}
                rows={3}
                {...typeRole('body', 'mt-1.5 w-full rounded-lg border border-rf-border-subtle bg-rf-surface-canvas p-2.5 text-rf-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring')}
              />
            </label>
          )}

          {openSpec?.requiresSnoozeUntil && (
            <SnoozeUntilField value={snoozeDraft} onChange={setSnoozeDraft} error={null} />
          )}

          {openSpec?.requiresSelection && (
            <p {...typeRole('body', 'mt-4 text-rf-text-secondary')}>
              {selection.length} item{selection.length === 1 ? '' : 's'} selected.
            </p>
          )}

          {/* One message, sourced from the one contract function — never a second, differently-worded
              copy of the same rule written inline for the dialog. */}
          {!openVerdict?.allowed && openVerdict?.reason && (
            <p {...typeRole('body', 'mt-2 text-rf-status-critical-text')}>{openVerdict.reason}</p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
