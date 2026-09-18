import { Link } from 'react-router-dom';
import { actionStoriesIndexPath } from '@/constants/actionStoriesRoutes';
import { typeRole } from '../blocks/typeRole';
import { lensAccent } from '../blocks/lensAccent';

import { glyph } from '../blocks/glyphSize';
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
      {/* A LINK IS INTERACTIVE, SO IT GETS THE BLUE — on hover and focus rather than at rest, because
          a breadcrumb sitting permanently blue would compete with the pane's actual actions and I4's
          whole point is that blue spent everywhere is blue spent nowhere. */}
      <Link
        to={actionStoriesIndexPath()}
        className="rounded-sm transition-colors duration-fast ease-standard hover:text-rf-brand-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rf-brand-focus-ring"
      >
        Action Stories
      </Link>
      {/* A TYPE ROLE MUST NEVER REACH AN ICON. `typeRole('micro')` carries `font-mono`, which wins
          over Font Awesome's own family, so the glyph's codepoint is looked up in JetBrains Mono,
          found missing, and drawn as .notdef — a tofu box. The size is a GLYPH size here, not a
          type role; see T95's icon exemption and T101's gate. */}
      <i className={`fa-solid fa-chevron-right ${glyph(7)}`} aria-hidden="true" />
      <span className="text-rf-text-secondary">{storyCode}</span>
      <i className={`fa-solid fa-chevron-right ${glyph(7)}`} aria-hidden="true" />
      <span className="text-rf-text-secondary capitalize">{stage}</span>
    </nav>
  );
}
