import { useId, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';

import { typeRole } from '../blocks/typeRole';
// Gates a real, hard-to-reverse action behind an explicit "are you sure" step — Nielsen Norman's
// own "error prevention" heuristic. Generic and business-agnostic: StageActionBar.jsx wires this up
// for whichever of its template-declared actions asks for confirmation (`actions[].confirm.required`
// — see manifests/validateManifest.js), never hardcoded to one verb (S9.11/execute genuinely writes
// live prices once a real backend exists — see INTEGRATION.md §3, one example of why this matters).
//
// Focus defaults to CANCEL, not Confirm (`initialFocusRef` on Modal) — a stray Enter/Space while
// the dialog is still opening should never land on the destructive/consequential choice.
//
// `children` is a generic extra-content slot (e.g. StageActionBar.jsx's reason/comment field for an
// action whose manifest declares `reason` metadata) — this component knows nothing about what it
// renders there; it just reserves the space between the description and the action buttons.
/**
 * @param {boolean} open
 * @param {string} title
 * @param {string} [description]
 * @param {string} [confirmLabel]
 * @param {string} [cancelLabel]
 * @param {() => void} onConfirm
 * @param {() => void} onCancel - also fired on Escape/backdrop click
 * @param {'default'|'destructive'} [tone] - 'destructive' renders Confirm in the critical color;
 *   use it only when the action is genuinely hard to undo from this UI.
 * @param {boolean} [loading] - the confirmed action is in flight; disables both buttons and shows
 *   a spinner on Confirm.
 * @param {boolean} [confirmDisabled] - disables Confirm only (Cancel stays clickable) without
 *   implying a mutation is in flight — e.g. a required reason field that's still empty/too short.
 * @param {import('react').ReactNode} [children] - optional extra content between the description
 *   and the action buttons.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'default',
  loading = false,
  confirmDisabled = false,
  children,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef(null);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
      initialFocusRef={cancelRef}
    >
      <h2
        id={titleId}
        {...typeRole('display', 'text-rf-text-primary')}
      >
        {title}
      </h2>
      {description && (
        <p id={descriptionId} {...typeRole('body', 'mt-2 text-rf-text-secondary')}>
          {description}
        </p>
      )}
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone === 'destructive' ? 'destructive' : 'primary'} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
