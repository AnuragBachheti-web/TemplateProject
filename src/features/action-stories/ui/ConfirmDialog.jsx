import { useId, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';

// Gates a real, hard-to-reverse action behind an explicit "are you sure" step — Nielsen Norman's
// own "error prevention" heuristic, and the one thing StageActionBar's Confirm/Approve/Start button
// never had: clicking it used to fire the mutation immediately, no matter how consequential the
// action (S9.11/execute genuinely writes live prices once a real backend exists — see
// INTEGRATION.md §3). This is the generic version; StageActionBar wires it to `confirmStage`.
//
// Focus defaults to CANCEL, not Confirm (`initialFocusRef` on Modal) — a stray Enter/Space while
// the dialog is still opening should never land on the destructive/consequential choice.
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
        className="font-serif text-[19px] font-medium leading-tight text-rf-text-primary"
        style={{ fontVariationSettings: "'opsz' 144" }}
      >
        {title}
      </h2>
      {description && (
        <p id={descriptionId} className="mt-2 text-[13px] leading-relaxed text-rf-text-secondary">
          {description}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone === 'destructive' ? 'destructive' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
