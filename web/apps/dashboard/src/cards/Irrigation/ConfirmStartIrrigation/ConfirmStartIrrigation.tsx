import { ConfirmDialog } from "@hort/ui";

/**
 * A start runs the whole sequence unattended — pre-wet, fertigation and flush —
 * dosing fertiliser and delivering the full cycle volume, so it is confirmed.
 * Stopping is not.
 */
export function ConfirmStartIrrigation({ open, onConfirm, onCancel }: { open: boolean; onConfirm(): void; onCancel(): void }) {
  return <ConfirmDialog
    open={open}
    title="Start irrigation?"
    message="The full sequence runs unattended: pre-wet, fertigation, then flush."
    confirmText="Start irrigation"
    onConfirm={onConfirm}
    onCancel={onCancel}
  />;
}
