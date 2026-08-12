import { ConfirmDialog } from "@hort/ui";

/**
 * Renaming is confirmed not because it is hazardous but because it is not what
 * it looks like: names are temporal (web ADR-0010), so a rename splits this
 * zone's watering history across two labels and renaming back leaves three.
 */
export function ConfirmZoneRename({ open, from, to, onConfirm, onCancel }: { open: boolean; from: string; to: string; onConfirm(): void; onCancel(): void }) {
  return <ConfirmDialog
    open={open}
    title="Rename this zone?"
    message={`“${from}” becomes “${to}”. Watering history keeps the name each event was recorded under, so past waterings stay labelled “${from}” and only new ones use “${to}”. This zone's history will read under two names, which makes it harder to track.`}
    danger
    confirmText="Rename zone"
    onConfirm={onConfirm}
    onCancel={onCancel}
  />;
}
