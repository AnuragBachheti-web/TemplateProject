import { useId } from 'react';
import { Link } from 'react-router-dom';
import { actionStoryPath } from '@/constants/actionStoriesRoutes';
import { useLedgerStore } from '@/store/useLedgerStore';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';

function relativeTime(iso, now = Date.now()) {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The reference's LedgerOverlay chrome — built on Modal.jsx (the same generic, accessible overlay
 * shell ConfirmDialog.jsx already reuses) rather than a second overlay implementation. Lists
 * useLedgerStore's own entries, newest first: every one is a real operator action that actually
 * settled against the (mock or real) API this session — see ledgerEntry.js for why the shape and
 * the "You" attribution are both deliberately honest about what this app can and can't back with
 * real data (no auth, no reversible action, no backend audit log to source a hash chain from).
 */
export default function LedgerOverlay() {
  const isOpen = useLedgerStore((s) => s.isOpen);
  const close = useLedgerStore((s) => s.close);
  const entries = useLedgerStore((s) => s.entries);
  const titleId = useId();

  return (
    <Modal open={isOpen} onClose={close} labelledBy={titleId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id={titleId}
            className="font-serif text-[19px] font-medium leading-tight text-rf-text-primary"
            style={{ fontVariationSettings: "'opsz' 144" }}
          >
            Ledger
          </h2>
          <p className="mt-0.5 text-[12px] text-rf-text-tertiary">Actions you&apos;ve taken this session.</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="shrink-0 rounded-md p-1 text-rf-text-tertiary hover:bg-rf-surface-sunken hover:text-rf-text-primary"
        >
          <i className="fa-solid fa-xmark text-[13px]" aria-hidden="true" />
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="mt-6 text-[13px] text-rf-text-secondary">Nothing here yet — approve, dismiss or snooze a proposal to see it recorded.</p>
      ) : (
        <ul className="mt-4 flex max-h-[60vh] flex-col divide-y divide-rf-border-subtle overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-rf-text-primary">
                  {entry.who} {entry.outcome === 'error' ? 'tried to ' : ''}
                  {entry.label}
                </p>
                <Link
                  to={actionStoryPath(entry.storyCode, entry.stage)}
                  onClick={close}
                  className="mt-0.5 block truncate font-mono text-[11px] uppercase tracking-[0.06em] text-rf-text-tertiary hover:text-rf-text-primary hover:underline"
                >
                  {entry.storyCode} · {entry.stage}
                </Link>
                {entry.outcome === 'error' && entry.detail && (
                  <p className="mt-1 text-[11.5px] text-rf-status-critical">{entry.detail}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={entry.outcome === 'error' ? 'critical' : 'success'}>{entry.outcome}</Badge>
                <span className="text-[10.5px] text-rf-text-tertiary">{relativeTime(entry.when)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
