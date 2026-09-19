import { useState } from 'react';

const NAV_ITEMS = [
  { label: 'Decisions', icon: 'fa-list-check', active: true },
  { label: 'Agents', icon: 'fa-user-group' },
  { label: 'Explore', icon: 'fa-compass' },
  { label: 'Integrations', icon: 'fa-puzzle-piece' },
];

const RECENT_ITEMS = ['Lorem ipsum dolor', 'Adipiscing elit sed', 'Incididunt ut labore', 'Aliqua ut enim ad'];

/**
 * Workspace-level rail (product areas), one level above Shell.jsx's own nav which lists the 26
 * Action Story instances. Every item here is placeholder chrome — same "structure now, data later"
 * posture as Shell.jsx's own Settings/Help links — nothing here is wired to a backend.
 */
export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav
      aria-label="Realify"
      className={`flex flex-shrink-0 flex-col border-r border-rf-border-subtle bg-rf-surface-canvas transition-[width] duration-200 ${
        collapsed ? 'w-[64px]' : 'w-64'
      }`}
    >
      <div className="flex items-center gap-2 border-b border-rf-border-subtle px-4 py-3.5">
        <span
          aria-hidden="true"
          className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-[7px] bg-rf-brand-blue-500 text-white"
        >
          <i className="fa-solid fa-star text-[10px]" aria-hidden="true" />
        </span>
        {!collapsed && (
          <span
            className="font-serif text-[16px] font-normal tracking-[-0.02em] text-rf-text-primary"
            style={{ fontVariationSettings: "'opsz' 144" }}
          >
            Realify
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="ml-auto grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-rf-text-tertiary hover:bg-rf-surface-sunken hover:text-rf-text-primary"
        >
          <i className="fa-solid fa-table-columns text-[11px]" aria-hidden="true" />
        </button>
      </div>

      <div className="px-2 pt-3">
        <a
          href="#ask"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[12.5px] font-medium text-rf-text-secondary hover:bg-rf-surface-sunken hover:text-rf-text-primary"
        >
          <i className="fa-solid fa-plus w-3.5 text-center text-[11px] text-rf-text-tertiary" aria-hidden="true" />
          {!collapsed && 'Ask'}
        </a>
      </div>

      <ul className="flex flex-col gap-px px-2 pt-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.label}>
            <a
              href="#"
              aria-current={item.active ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[12.5px] font-medium transition-colors ${
                item.active
                  ? 'bg-rf-brand-tint-08 text-rf-text-primary'
                  : 'text-rf-text-secondary hover:bg-rf-surface-sunken hover:text-rf-text-primary'
              }`}
            >
              <i
                className={`fa-solid ${item.icon} w-3.5 text-center text-[11px] ${
                  item.active ? 'text-rf-brand-blue-500' : 'text-rf-text-tertiary'
                }`}
                aria-hidden="true"
              />
              {!collapsed && item.label}
            </a>
          </li>
        ))}
      </ul>

      {!collapsed && (
        <div className="mt-4 px-4">
          <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-rf-text-tertiary">Recent</p>
        </div>
      )}
      <ul className="flex flex-col gap-px px-2 pt-1.5">
        {RECENT_ITEMS.map((label) => (
          <li key={label}>
            <a
              href="#"
              className="block truncate rounded-md px-3 py-[6.5px] text-[12px] text-rf-text-secondary hover:bg-rf-surface-sunken hover:text-rf-text-primary"
            >
              {collapsed ? label.slice(0, 1) : label}
            </a>
          </li>
        ))}
      </ul>
      <div className="px-2 pt-1">
        <a
          href="#"
          className="flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[12px] font-medium text-rf-text-secondary hover:bg-rf-surface-sunken hover:text-rf-text-primary"
        >
          <i className="fa-solid fa-clock-rotate-left w-3.5 text-center text-[10px] text-rf-text-tertiary" aria-hidden="true" />
          {!collapsed && 'View All History'}
        </a>
      </div>

      <div className="mt-auto border-t border-rf-border-subtle px-2 py-2">
        <a
          href="#settings"
          className="flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[12.5px] font-medium text-rf-text-secondary hover:bg-rf-surface-sunken hover:text-rf-text-primary"
        >
          <i className="fa-solid fa-gear w-3.5 text-center text-[11px] text-rf-text-tertiary" aria-hidden="true" />
          {!collapsed && 'Settings'}
        </a>
      </div>
    </nav>
  );
}
