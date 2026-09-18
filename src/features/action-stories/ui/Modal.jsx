import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// The generic overlay shell — WAI-ARIA's own Dialog (Modal) pattern, not invented here: portaled to
// `document.body` (so a parent's `overflow`/`transform` never clips or z-index-traps it — StagePage
// already scrolls its own content), backdrop click + Escape both close it, focus moves into the
// dialog on open and is trapped there (Tab/Shift+Tab cycle inside, never leak to the page behind),
// and returns to whatever triggered it on close. See ConfirmDialog.jsx for the one call site this
// project needs today; kept generic (title/body are just `children`) so a later "view diff"-style
// dialog reuses this instead of a second overlay implementation.
export default function Modal({ open, onClose, labelledBy, describedBy, initialFocusRef, children }) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const toFocus = initialFocusRef?.current ?? dialogRef.current;
    toFocus?.focus();

    function focusableElements() {
      const nodes = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      return nodes ? Array.from(nodes) : [];
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusableElements();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // no scrolling the page behind an open dialog

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-xl border border-rf-border-subtle bg-rf-surface-raised p-6 shadow-overlay outline-none"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
