import { useId, useState } from 'react';

// "Recognition rather than recall" — Nielsen Norman's own heuristic, and the one this app's own
// jargon (confidence intervals, elasticity, GMROI, MAP, Buy Box parity — see manifests/REPORT.md's
// own vocabulary table) genuinely needs: a value or label can stay short and precise on the page
// while its explanation is one hover/focus away, instead of either a wall of inline explanatory
// text or a new user left to guess. WAI-ARIA's own tooltip pattern, not invented here: shows on
// hover AND on keyboard focus (never hover-only — a keyboard-only user gets nothing otherwise),
// hides on blur/mouse-leave/Escape, and the trigger carries `aria-describedby` pointing at the
// tooltip's own id so a screen reader announces it the same moment it becomes visible.
//
// Deliberately simple (no portal, no collision-aware repositioning) — `placement` picks a fixed
// side and callers keep it near a page edge at their own judgment; a denser positioning engine can
// replace the internals later without changing how any call site uses this.
/**
 * @param {React.ReactNode} content - the explanation; when falsy, children render completely
 *   unwrapped (never an empty, dead `role="tooltip"` waiting to show nothing).
 * @param {'top'|'bottom'} [placement]
 */
export default function Tooltip({ content, placement = 'top', children }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  if (!content) return children;

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      <span
        tabIndex={0}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide();
        }}
        aria-describedby={visible ? id : undefined}
        className="inline-flex outline-none focus-visible:ring-2 focus-visible:ring-rf-brand-focus-ring focus-visible:ring-offset-1"
      >
        {children}
      </span>
      {visible && (
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-max max-w-[240px] rounded-md bg-rf-text-primary px-2.5 py-1.5 text-[11px] font-medium leading-snug text-rf-surface-canvas shadow-lg ${
            placement === 'bottom' ? 'left-1/2 top-full mt-1.5 -translate-x-1/2' : 'bottom-full left-1/2 mb-1.5 -translate-x-1/2'
          }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
