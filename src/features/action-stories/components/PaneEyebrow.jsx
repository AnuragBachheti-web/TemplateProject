import { Link } from 'react-router-dom';
import { actionStoriesIndexPath } from '@/constants/actionStoriesRoutes';
import { typeRole } from '../blocks/typeRole';
import { lensAccent } from '../blocks/lensAccent';

/**
 * THE PANE EYEBROW — the breadcrumb line above a pane title, and THE ONLY PLACE A LENS IS DRAWN.
 *
 * Extracted from StagePage's header in Phase 5E Part 2 so the lens/status separation R86 requires
 * could be ASSERTED rather than promised: T96b renders this for every lens and fails if a status
 * colour ever lands on the same element as an accent. Left inline it was only reachable through a
 * full page render with a router and a store, and a constraint that is awkward to test is a
 * constraint that stops being tested.
 *
 * The accent is a 3px bar. It is wayfinding, not a verdict — see lensAccent.js for why that
 * distinction is load-bearing, given that the cash lens and "critical" are the same hue.
 */
export default function PaneEyebrow({ lens, storyCode, stage }) {
  return (
    <nav aria-label="Breadcrumb" {...typeRole('label', 'flex items-center gap-1.5 text-rf-text-tertiary')}>
      <span
        className={`h-3 w-[3px] shrink-0 rounded-full ${lensAccent(lens).className}`}
        aria-hidden="true"
      />
      {/* A colour says nothing to anyone who cannot see it. */}
      <span className="sr-only">{lens} lens</span>
      <Link to={actionStoriesIndexPath()} className="transition-colors hover:text-rf-text-primary">
        Action Stories
      </Link>
      <i {...typeRole('micro', 'fa-solid fa-chevron-right')} aria-hidden="true" />
      <span className="text-rf-text-secondary">{storyCode}</span>
      <i {...typeRole('micro', 'fa-solid fa-chevron-right')} aria-hidden="true" />
      <span className="text-rf-text-secondary capitalize">{stage}</span>
    </nav>
  );
}
