import { useId } from "react";
import { Button } from "../Button";
import { Modal } from "../Modal/Modal";
import { variants } from "../theme/variants";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  danger?: boolean;
  status?: string;
  statusDanger?: boolean;
  pending?: boolean;
  confirmDisabled?: boolean;
  onConfirm(): void;
  onCancel(): void;
};

/**
 * The shape every Confirmation takes; it holds no domain knowledge of its own.
 * `danger` colours the confirm button for a destructive act, `statusDanger` the
 * result line — they move independently, since a reset is destructive from the
 * outset but only reports in red once the device refuses. Otherwise the confirm
 * button is the affirmative one on the dialog and carries `action`; Cancel is
 * always the plain one, so the pair never shows two primaries.
 */
export function ConfirmDialog({ open, title, message, confirmText, danger = false, status = "", statusDanger = false, pending = false, confirmDisabled = false, onConfirm, onCancel }: Props) {
  const id = useId();
  const titleId = `${id}-title`, messageId = `${id}-message`;

  return <Modal open={open} labelledBy={titleId} describedBy={messageId} dismissible={!pending} onDismiss={onCancel}>
    <h2 id={titleId} className={variants.dialog.title}>{title}</h2>
    <p id={messageId} className={variants.dialog.text}>{message}</p>
    <p className={`${variants.dialog.status}${statusDanger ? ` ${variants.dialog.danger}` : ""}`} aria-live="polite">{status}</p>
    <div className={variants.dialog.actions}>
      <Button onClick={onCancel} disabled={pending}>Cancel</Button>
      <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={confirmDisabled || pending}>{confirmText}</Button>
    </div>
  </Modal>;
}
