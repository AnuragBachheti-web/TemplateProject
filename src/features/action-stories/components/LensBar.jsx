import { LENSES } from '../contract/decisionObject';
import { categoricalColor } from '../blocks/chartPalette';
import Chip from '../ui/Chip';

function titleCase(word) {
  return typeof word === 'string' && word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word;
}

/**
 * The reference's own chip row (Lens: Cash · Margin, Controller, Dial: Suggest) — reads the three
 * Decision Object axes that are REQUIRED on every Decision Object (see decisionObject.js's "seven
 * runtime axes") but, until now, were never actually shown to the operator anywhere: they drove
 * template selection and eligibility only. `mode` used to additionally leak out as a bare "Mode
 * suggest" line in StagePage's own meta row — removed there once this became the one place it's
 * shown, so the same fact is never printed twice on one page (the exact bug StagePage.jsx's own
 * `ProposalHeader` doc comment already fixed once for the title).
 *
 * Deliberately does NOT surface `proposal.agents` (the reference's "engine chip" — named models
 * like "Fee Reconciliation Engine") here: that data already renders in full, with each agent's own
 * role, as a body panel wherever a manifest includes it. Repeating it as a compact top-of-page chip
 * would be the same "shown twice" problem in the other direction.
 *
 * The lens dot is colored by chartPalette.js's fixed categorical order (LENSES' own declared
 * order), not a bespoke palette — same "identity, never severity" rule chartPalette.js documents
 * for chart series, and the reason `rf-status-critical` is never reached for here: a lens is a
 * category an operator is IN, not a verdict on their proposal.
 */
export default function LensBar({ decision }) {
  if (!decision) return null;

  const lensIndex = LENSES.indexOf(decision.lens);
  const chips = [];
  if (decision.lens) {
    chips.push({
      key: 'lens',
      dotColor: lensIndex >= 0 ? categoricalColor(lensIndex) : undefined,
      label: `Lens: ${titleCase(decision.lens)}`,
    });
  }
  if (decision.persona) {
    chips.push({ key: 'persona', icon: 'fa-solid fa-user', label: titleCase(decision.persona) });
  }
  if (decision.mode) {
    chips.push({ key: 'mode', icon: 'fa-solid fa-sliders', label: `Dial: ${titleCase(decision.mode)}` });
  }

  if (chips.length === 0) return null;

  return (
    <div role="list" aria-label="Context" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Chip key={chip.key} dotColor={chip.dotColor} icon={chip.icon}>
          {chip.label}
        </Chip>
      ))}
    </div>
  );
}
