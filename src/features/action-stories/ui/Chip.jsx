// A contextual descriptor pill — LensBar.jsx's building block. Distinct from Badge.jsx: a Badge is
// a verdict/state on a piece of content ("Blocked", "Pinned"); a Chip is a piece of standing
// context about the whole page ("Lens: Cash", "Controller"), bordered and outlined rather than
// tinted, matching the reference's own chip-row treatment.
/**
 * @param {string} [dotColor] - a resolved CSS color (e.g. a chartPalette.js categorical token) for
 *   an identity dot, when this chip represents one of a fixed set of colored categories.
 * @param {string} [icon] - a Font Awesome class string, shown when there's no `dotColor`.
 */
export default function Chip({ dotColor, icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-rf-border-subtle bg-rf-surface-canvas px-2.5 py-1 text-[11.5px] font-medium text-rf-text-secondary ${className}`}
    >
      {dotColor ? (
        <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
      ) : icon ? (
        <i className={`${icon} text-[10px] text-rf-text-tertiary`} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
