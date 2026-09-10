import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';
import { getWorkflowIndex } from '@/services/actionStoriesService';

/**
 * The left sidebar listing all 26 workflows, plus the page outlet beside it. Fetches the
 * workflow index once; StagePage (rendered in the outlet) fetches its own stage data separately.
 */
export default function Shell() {
  const { code: activeCode } = useParams();
  const [workflows, setWorkflows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getWorkflowIndex()
      .then((index) => {
        if (!cancelled) setWorkflows(index);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-screen bg-rf-surface-sunken">
      <nav className="flex w-64 flex-shrink-0 flex-col overflow-y-auto border-r border-rf-border-subtle bg-rf-surface-canvas">
        <div className="border-b border-rf-border-subtle px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-rf-text-secondary">Action Stories</p>
        </div>

        {error && <p className="px-4 py-3 text-[12px] text-rose-600">Couldn&rsquo;t load workflows.</p>}

        <ul className="flex flex-col gap-0.5 p-2">
          {workflows.map((wf) => (
            <li key={wf.code}>
              <NavLink
                to={actionStoryPath(wf.code, wf.stages[0])}
                className={`block truncate rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  activeCode === wf.code
                    ? 'bg-rf-brand-tint-08 text-rf-brand-indicator'
                    : 'text-rf-text-secondary hover:bg-rf-surface-sunken hover:text-rf-text-primary'
                }`}
              >
                <span className="mr-2 font-mono text-[10.5px] text-rf-text-tertiary">{wf.code}</span>
                {wf.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
