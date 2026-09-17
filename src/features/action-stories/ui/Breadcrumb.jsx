import { Link } from 'react-router-dom';

// Extracted from StagePage.jsx's own `ProposalHeader`, which had this exact markup inline (one
// call site so far, but the same one-off-per-block drift Button.jsx/Badge.jsx already fixed
// elsewhere — a second page that needs wayfinding, e.g. a future Ledger view, would otherwise
// re-invent the identical `<nav aria-label="Breadcrumb">` rather than reuse one).
//
// The LAST item is always the current page: rendered as plain text, never a link, and never
// chevron-suffixed. Every earlier item is real navigation.
/**
 * @param {{ label: string, to?: string }[]} items
 */
export default function Breadcrumb({ items, className = '' }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-rf-text-tertiary ${className}`}
    >
      {items.map((item, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <i className="fa-solid fa-chevron-right shrink-0 text-[7px]" aria-hidden="true" />}
          {item.to ? (
            <Link to={item.to} className="truncate transition-colors hover:text-rf-text-primary">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="truncate capitalize text-rf-text-secondary">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
