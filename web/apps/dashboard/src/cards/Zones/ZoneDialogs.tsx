import { useEffect, useState } from "react";
import { Button, ConfirmDialog, Modal, variants } from "@hort/ui";

export const ZONE_NAME_MAX = 40;

/** A zone exists before it has a channel, so creating one asks for a name only. */
export function CreateZone({ open, onCreate, onCancel }: { open: boolean; onCreate(name: string): void; onCancel(): void }) {
  const [name, setName] = useState("");
  useEffect(() => { if (open) setName(""); }, [open]);
  const trimmed = name.trim();

  return <Modal open={open} labelledBy="create-zone-title" onDismiss={onCancel}>
    <h2 id="create-zone-title" className={variants.dialog.title}>New zone</h2>
    <p className={`${variants.dialog.text} mb-4`}>Name the place this zone waters. Assign it to a channel afterwards, on the System card.</p>
    <label className="grid gap-[6px]">
      <span className={variants.schematic.fieldLabel}>Zone name</span>
      <input autoFocus className={`${variants.schematic.fieldInput} h-[46px]`} value={name} maxLength={ZONE_NAME_MAX} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && trimmed) onCreate(trimmed); }}/>
    </label>
    <div className={variants.dialog.actions}>
      <Button onClick={onCancel}>Cancel</Button>
      <Button variant="primary" disabled={!trimmed} onClick={() => onCreate(trimmed)}>Create zone</Button>
    </div>
  </Modal>;
}

/**
 * Renaming is a plain edit, not a Confirmation: names are current-only, so a
 * rename means "I called it the wrong thing" and relabels this zone's whole
 * history (web ADR-0015). The other case — the place itself changed — is
 * archive-and-create, which the copy points at.
 */
export function RenameZone({ open, current, onRename, onCancel }: { open: boolean; current: string; onRename(name: string): void; onCancel(): void }) {
  const [name, setName] = useState(current);
  useEffect(() => { if (open) setName(current); }, [open, current]);
  const trimmed = name.trim();

  return <Modal open={open} labelledBy="rename-zone-title" onDismiss={onCancel}>
    <h2 id="rename-zone-title" className={variants.dialog.title}>Rename zone</h2>
    <p className={`${variants.dialog.text} mb-4`}>Renaming relabels this zone's whole history. If the place itself changed, archive it and create a new zone instead.</p>
    <label className="grid gap-[6px]">
      <span className={variants.schematic.fieldLabel}>Zone name</span>
      <input autoFocus className={`${variants.schematic.fieldInput} h-[46px]`} value={name} maxLength={ZONE_NAME_MAX} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && trimmed && trimmed !== current) onRename(trimmed); }}/>
    </label>
    <div className={variants.dialog.actions}>
      <Button onClick={onCancel}>Cancel</Button>
      <Button variant="primary" disabled={!trimmed || trimmed === current} onClick={() => onRename(trimmed)}>Rename zone</Button>
    </div>
  </Modal>;
}

/**
 * Archiving is confirmed because its consequence is not visible in the click:
 * it also clears the zone's channel assignment, so that channel stops feeding
 * anything named (web ADR-0014). Nothing is lost, so it is not destructive.
 */
export function ConfirmArchiveZone({ open, name, channel, onConfirm, onCancel }: { open: boolean; name: string; channel: number | null; onConfirm(): void; onCancel(): void }) {
  return <ConfirmDialog
    open={open}
    title="Archive this zone?"
    message={`“${name}” leaves the selectable list and keeps everything it ever watered.${channel === null ? "" : " The channel feeding it will be left unassigned."} You can restore it later, but the assignment does not come back.`}
    confirmText="Archive zone"
    onConfirm={onConfirm}
    onCancel={onCancel}
  />;
}
