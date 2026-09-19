/**
 * Placeholder composer bar. Not wired to a backend — same "structure now, data later" posture as
 * Shell.jsx's own TopBar search input.
 *
 * Floats over the canvas (no docked background/border of its own) so it reads as a pill sitting on
 * the page, not a toolbar strip fused to AppSidebar's edge.
 */
export default function BottomAskBar() {
  return (
    <div className="flex-shrink-0 px-6 pb-4 pt-2">
      <div className="flex w-full items-center gap-2 rounded-full border border-rf-border-default bg-rf-surface-canvas px-3 py-2 shadow-[var(--shadow-md)]">
        <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-rf-surface-sunken text-rf-text-tertiary">
          <i className="fa-solid fa-plus text-[11px]" aria-hidden="true" />
        </span>
        <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-rf-text-tertiary">
          <i className="fa-solid fa-sliders text-[11px]" aria-hidden="true" />
        </span>
        <input
          type="text"
          placeholder="Ask Realify (or type /upload)"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-rf-text-primary placeholder:text-rf-text-tertiary focus-visible:outline-none"
        />
        <span className="hidden items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-rf-text-tertiary sm:flex">
          <i className="fa-solid fa-sparkles text-[10px]" aria-hidden="true" />
          Think
        </span>
        <button
          type="button"
          aria-label="Voice input"
          className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-rf-text-tertiary hover:bg-rf-surface-sunken hover:text-rf-text-primary"
        >
          <i className="fa-solid fa-microphone text-[11px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Send"
          className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-rf-brand-blue-500 text-white"
        >
          <i className="fa-solid fa-arrow-up text-[11px]" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1.5 text-center font-mono text-[9.5px] uppercase tracking-[0.08em] text-rf-text-tertiary">
        Realify is AI and can make mistakes.
      </p>
    </div>
  );
}
