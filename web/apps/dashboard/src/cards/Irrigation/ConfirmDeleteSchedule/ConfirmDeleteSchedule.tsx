import { ConfirmDialog } from "@hort/ui";
import type { ScheduleEntry } from "@hort/contracts";
import { frequencyText } from "../schedule";

/**
 * Deleting a schedule is destructive and not undoable — entries are immutable,
 * so there is nothing to restore, only the wizard to walk again (web ADR-0017).
 * It names the zone and the cadence about to stop, because "Delete" on a row of
 * four is exactly the click that goes to the wrong row.
 */
export function ConfirmDeleteSchedule({ entry, label, onConfirm, onCancel }: { entry: ScheduleEntry | null; label: string; onConfirm(): void; onCancel(): void }) {
  return <ConfirmDialog
    open={entry !== null}
    title="Delete this schedule?"
    message={entry ? `${label} will no longer be watered at ${entry.time}, ${frequencyText(entry.frequency).toLowerCase()}. Recreating it means setting it up again.` : ""}
    confirmText="Delete schedule"
    danger
    onConfirm={onConfirm}
    onCancel={onCancel}
  />;
}
