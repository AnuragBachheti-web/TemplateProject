import Shell from '@/features/action-stories/components/Shell';
import AppSidebar from '@/features/app-shell/AppSidebar';
import BottomAskBar from '@/features/app-shell/BottomAskBar';
import { useThemeStore } from '@/store/useThemeStore';

const TODAY_LABEL = new Date()
  .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  .toUpperCase();

const THEME_CYCLE = ['light', 'dark', 'system'];
const THEME_ICON = { light: 'fa-sun', dark: 'fa-moon', system: 'fa-circle-half-stroke' };
const THEME_LABEL = { light: 'Light', dark: 'Dark', system: 'System' };

/** Cycles light → dark → system → light. Moved up from Shell.jsx's old TopBar, which is gone now that this header is the one true top bar. */
function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <button
      type="button"
      onClick={() => setTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length])}
      className="grid h-8 w-8 place-items-center rounded-md text-rf-text-tertiary transition-colors hover:bg-rf-surface-sunken hover:text-rf-text-primary"
      aria-label={`Theme: ${THEME_LABEL[preference]}. Click to change.`}
      title={`Theme: ${THEME_LABEL[preference]}`}
    >
      <i className={`fa-solid ${THEME_ICON[preference]} text-[13px]`} aria-hidden="true" />
    </button>
  );
}

const TONE_BG = {
  success: 'bg-emerald-50',
  critical: 'bg-rose-50',
  blue: 'bg-indigo-50',
};
const TONE_TEXT = {
  success: 'text-emerald-600',
  critical: 'text-rose-600',
  blue: 'text-indigo-600',
};

/** Workspace header: page identity + view toggles. Placeholder chrome, not wired to data. */
function DecisionsHeader() {
  return (
    <header className="flex flex-shrink-0 items-center justify-between bg-rf-surface-sunken px-6 py-4">
      <div>
        <h1
          className="font-serif text-[26px] font-normal leading-none tracking-[-0.02em] text-rf-text-primary"
          style={{ fontVariationSettings: "'opsz' 144" }}
        >
          Decisions
        </h1>
        <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-rf-text-tertiary">{TODAY_LABEL}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        {['fa-list', 'fa-table-cells-large', 'fa-arrow-rotate-right'].map((icon) => (
          <button
            key={icon}
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md text-rf-text-tertiary transition-colors hover:bg-rf-surface-sunken hover:text-rf-text-primary"
          >
            <i className={`fa-solid ${icon} text-[13px]`} aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          aria-label="Notifications"
          className="grid h-8 w-8 place-items-center rounded-full text-rf-text-tertiary transition-colors hover:bg-rf-surface-sunken hover:text-rf-text-primary"
        >
          <i className="fa-regular fa-bell text-[14px]" aria-hidden="true" />
        </button>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-full bg-rf-surface-sunken text-rf-text-tertiary"
        >
          <i className="fa-solid fa-user text-[13px]" aria-hidden="true" />
        </span>
      </div>
    </header>
  );
}

/** "The Brief" summary card. All values below are placeholder dummy data, not real business data. */
function BriefBanner() {
  const metrics = [
    { label: 'Opportunity', value: '$2,222,222', icon: 'fa-arrow-trend-up', tone: 'success' },
    { label: 'SKUs with signals', value: '2,222', icon: 'fa-circle-nodes', tone: 'blue' },
    { label: 'At risk', value: '$333,333', icon: 'fa-triangle-exclamation', tone: 'critical' },
  ];

  return (
    <section className="rounded-[var(--r-lg)] bg-indigo-50 p-5">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-indigo-600">The Brief</p>
      <p className="mt-1.5 text-[19px] font-semibold leading-snug text-rf-text-primary">
        Lorem ipsum revenue is <span className="tabular-nums">$1,111,111</span> all time.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center gap-3 rounded-[var(--r-md)] bg-rf-surface-canvas px-4 py-3">
            <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full ${TONE_BG[m.tone]}`}>
              <i className={`fa-solid ${m.icon} text-[12px] ${TONE_TEXT[m.tone]}`} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-rf-text-tertiary">{m.label}</span>
              <span className="block text-[15px] font-semibold text-rf-text-primary">{m.value}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Overview KPI strip. All values below are placeholder dummy data, not real business data. */
function KpiOverview() {
  const cards = [
    { label: 'Revenue', value: '$1,111,111', icon: 'fa-arrow-trend-up', color: 'text-emerald-600' },
    { label: 'Margin', value: '22.2%', icon: 'fa-dollar-sign', color: 'text-indigo-600' },
    { label: 'Inventory', value: '3,333 units', icon: 'fa-box', color: 'text-orange-500' },
    { label: 'Ad spend', value: '4.4x', icon: 'fa-pen', color: 'text-rose-600' },
    { label: 'Cash received', value: '$5,555,555', icon: 'fa-wallet', color: 'text-blue-600' },
  ];

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-rf-text-secondary">Overview</h2>
        <button
          type="button"
          className="rounded-full border border-rf-border-default px-3 py-1 text-[11.5px] font-medium text-rf-text-secondary hover:bg-rf-surface-sunken"
        >
          All time
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-[var(--r-md)] border border-rf-border-subtle bg-rf-surface-canvas p-4">
            <div className="flex items-center gap-1.5">
              <i className={`fa-solid ${c.icon} text-[12px] ${c.color}`} aria-hidden="true" />
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-rf-text-tertiary">{c.label}</span>
            </div>
            <p className="mt-2 text-[20px] font-semibold tabular-nums text-rf-text-primary">{c.value}</p>
            <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-rf-text-tertiary">All time</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** "Queue" section heading + filters. The count is placeholder; the content below it is real. */
function QueueToolbar() {
  return (
    <div className="mt-8">
      <h2
        className="font-serif text-[19px] font-normal text-rf-text-primary"
        style={{ fontVariationSettings: "'opsz' 144" }}
      >
        Queue <span className="font-mono text-[12px] font-normal text-rf-text-tertiary">· 2,222 signals</span>
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {['Category', 'Status', 'SKU', 'All time'].map((f) => (
          <button
            key={f}
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-rf-border-default bg-rf-surface-canvas px-3 py-1.5 text-[11.5px] font-medium text-rf-text-secondary hover:bg-rf-surface-sunken"
          >
            {f}
            <i className="fa-solid fa-chevron-down text-[8px] text-rf-text-tertiary" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {['All Categories', 'All Status'].map((f) => (
          <button
            key={f}
            type="button"
            className="rounded-full border border-rf-border-default bg-rf-surface-canvas px-3 py-1.5 text-[11.5px] font-medium text-rf-text-secondary hover:bg-rf-surface-sunken"
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Workspace-level wrap around the Action Stories scaffold (Shell + everything it renders). This
 * component is the ONLY thing new here — Shell and everything inside it (WorkflowNav, StagePage,
 * StageRenderer, the real data) is embedded completely unchanged in the boxed panel below.
 *
 * The panel needs `transform` on its own box: Shell's internal nav is `position: fixed`, which
 * normally positions against the viewport. A `transform` on this ancestor makes it the containing
 * block instead, so Shell's fixed nav confines itself to this box rather than escaping over
 * AppSidebar/DecisionsHeader. (Shell.jsx's own root height was also changed from `h-screen` to
 * `h-full` for the same reason — so it fills this fixed-height box instead of always being 100vh.)
 */
export default function DecisionsShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-rf-surface-sunken font-sans text-rf-text-primary">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DecisionsHeader />
        <main className="flex-1 overflow-y-auto bg-rf-surface-sunken">
          <div className="w-full px-6 py-6">
            <div className="rounded-[var(--r-lg)] border border-rf-border-subtle bg-rf-surface-canvas p-6 shadow-[var(--shadow-sm)]">
              <BriefBanner />
              <KpiOverview />
              <QueueToolbar />
              <div
                className="relative mt-3 h-[75vh] min-h-[520px] overflow-hidden rounded-[var(--r-md)]"
                style={{ transform: 'translateZ(0)' }}
              >
                <Shell />
              </div>
            </div>
          </div>
        </main>
        <BottomAskBar />
      </div>
    </div>
  );
}
