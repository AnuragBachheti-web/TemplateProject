import { resolveBinding } from '@/features/action-stories/manifests/resolveBinding';

/**
 * The one place that decides whether this stage's real action — there is currently exactly one,
 * "confirm" (see StageActionBar.jsx's own doc comment for why this app doesn't have a dismiss/
 * snooze/modify/send-back verb yet: none of them have any backing in the real product/API contract
 * available in this repo, only "confirm" does) — is actually allowed to execute right now, and
 * what to call it.
 *
 * Reads the same `guardrail_*` manifest vocabulary `extraction/classifyBlocks.js` already derives
 * from the real per-workflow mockup data (`guardrail_blocked`/`guardrail_can_approve`/
 * `guardrail_reason`/`guardrail_cta_label` — see that file's own `EXACT_KEY_OVERRIDES` entries).
 * Never invents a new field or capability model — this is exactly the "derive from the existing
 * domain contract instead of building a new one" the brief this was written against required.
 *
 * That guardrail data was already being extracted, classified, and rendered as its own informational
 * "Guardrails" rail section (a checklist, a blocked/can-approve flag, a reason) — but the actual
 * action button (`StageActionBar.jsx`) never consulted it, so a proposal whose own data says
 * `blocked: true, canApprove: false` still showed a fully clickable, unguarded Approve button. This
 * is a real, current gap, not a hypothetical one: 3 of the 105 fixtures (`S9.16`, `S9.17`, `S9.19`
 * decide stages) have exactly that shape today.
 *
 * A stage with NO guardrail data at all — the overwhelming majority (82 of 105 decide/execute
 * stages) — is not treated as blocked: absence of a guardrail model is not itself a guardrail.
 * `canConfirm` defaults to `true` whenever neither `guardrail_blocked` nor `guardrail_can_approve`
 * is present on this stage's manifest at all.
 *
 * @param {object} manifest - one stage's manifest ({ blocks: [...] }), as loaded by StagePage.
 * @param {object} fixture - that stage's raw fixture ({ data: {...}, ... }), as loaded by StagePage.
 * @returns {{ canConfirm: boolean, blockedReason: string|null, ctaLabel: string|null }}
 */
export function resolveStageActionEligibility(manifest, fixture) {
  const blocked = resolveSlot(manifest, fixture, 'guardrail_blocked');
  const canApprove = resolveSlot(manifest, fixture, 'guardrail_can_approve');
  const reason = resolveSlot(manifest, fixture, 'guardrail_reason');
  const ctaLabel = resolveSlot(manifest, fixture, 'guardrail_cta_label');

  // Either signal alone is enough to block — a real workflow in the current corpus only ever sends
  // one of `blocked`/`canApprove`, never both disagreeing, but treating them as independently
  // sufficient ("either one says no") is the safe reading rather than requiring both to agree.
  const isBlocked = blocked === true || canApprove === false;

  return {
    canConfirm: !isBlocked,
    blockedReason: isBlocked && isNonEmptyString(reason) ? reason : null,
    ctaLabel: isNonEmptyString(ctaLabel) ? ctaLabel : null,
  };
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/** A manifest block's own resolved value by slotName, or `undefined` when this stage's manifest
 * doesn't declare that slot at all (most stages don't carry any guardrail model — see this
 * module's own doc comment for how "absent" is handled at each call site above). */
function resolveSlot(manifest, fixture, slotName) {
  const block = manifest?.blocks?.find((b) => b.slotName === slotName);
  return block ? resolveBinding(block.binding, fixture) : undefined;
}
