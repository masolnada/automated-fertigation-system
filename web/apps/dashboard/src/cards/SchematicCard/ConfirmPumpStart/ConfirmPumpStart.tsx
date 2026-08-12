import { ConfirmDialog } from "@hort/ui";

/**
 * Starting the pump is confirmed; stopping it is not. Only one direction is
 * hazardous, and nothing should stand between the operator and a stop.
 */
export function ConfirmPumpStart({ open, onConfirm, onCancel }: { open: boolean; onConfirm(): void; onCancel(): void }) {
  return <ConfirmDialog
    open={open}
    title="Start the pump?"
    message="Water will flow through the open source and zone until you stop it."
    confirmText="Start pump"
    onConfirm={onConfirm}
    onCancel={onCancel}
  />;
}
