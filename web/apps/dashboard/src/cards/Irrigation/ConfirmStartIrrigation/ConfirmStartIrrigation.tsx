import { ConfirmDialog } from "@hort/ui";

/**
 * A start runs the whole sequence unattended — pre-wet, fertigation and flush —
 * dosing fertiliser and delivering the full cycle volume, so it is confirmed.
 * Stopping is not.
 *
 * It names the zone the water is going to, because that is now a choice the
 * operator makes here and watering the wrong place is the mistake this dialog
 * exists to catch. An unassigned channel names itself, which is all there is to
 * say about it.
 */
export function ConfirmStartIrrigation({ open, label, onConfirm, onCancel }: { open: boolean; label: string; onConfirm(): void; onCancel(): void }) {
  return <ConfirmDialog
    open={open}
    title="Start irrigation?"
    message={`${label} gets the full sequence, unattended: pre-wet, fertigation, then flush.`}
    confirmText="Start irrigation"
    onConfirm={onConfirm}
    onCancel={onCancel}
  />;
}
