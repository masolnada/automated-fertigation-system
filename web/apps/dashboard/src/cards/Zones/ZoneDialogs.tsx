import { useEffect, useState } from "react";
import { Button, ConfirmDialog, Modal, ZoneMarker, variants, zoneColourPalette, zoneTintStyle, type ZoneColour } from "@hort/ui";

export const ZONE_NAME_MAX = 40;

/**
 * A Zone needs only a name to exist. Colour is a browser-local aid picked later
 * from the Zones list (web ADR-0019), so it is not part of creation.
 */
export function CreateZone({ open, onCreate, onCancel }: { open: boolean; onCreate(name: string): void | Promise<void>; onCancel(): void }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setName("");
    setPending(false);
    setError("");
  }, [open]);
  const trimmed = name.trim();

  const submit = async () => {
    if (!trimmed || pending) return;
    setPending(true);
    setError("");
    try {
      await onCreate(trimmed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create zone");
      setPending(false);
    }
  };

  return <Modal open={open} labelledBy="create-zone-title" onDismiss={() => { if (!pending) onCancel(); }}>
    <h2 id="create-zone-title" className={variants.dialog.title}>New zone</h2>
    <p className={`${variants.dialog.text} mb-4`}>Name the place this zone waters. Give it a color and assign it to a channel afterward, from the Zones and System cards.</p>
    <label className="grid gap-[6px]">
      <span className={variants.schematic.fieldLabel}>Zone name</span>
      <input autoFocus className={`${variants.schematic.fieldInput} h-[46px]`} value={name} maxLength={ZONE_NAME_MAX} disabled={pending} onChange={(event) => { setName(event.target.value); setError(""); }} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}/>
    </label>
    <p role={error ? "alert" : "status"} className={`m-0 mt-3 min-h-[1.5rem] text-[0.75rem] font-bold ${error ? "text-danger" : ""}`}>{error}</p>
    <div className={variants.dialog.actions}>
      <Button disabled={pending} onClick={onCancel}>Cancel</Button>
      <Button variant="primary" disabled={!trimmed || pending} onClick={() => void submit()}>{pending ? "Creating…" : "Create zone"}</Button>
    </div>
  </Modal>;
}

/**
 * Pick or clear a Zone's colour. A browser-local aid only (web ADR-0019): the
 * palette is offered freely, repeats are fine, and “No colour” returns the Zone
 * to gray.
 */
export function EditZoneColour({ open, zoneName, current, onPick, onCancel }: { open: boolean; zoneName: string; current: ZoneColour | undefined; onPick(colour: ZoneColour | null): void; onCancel(): void }) {
  return <Modal open={open} labelledBy="edit-zone-colour-title" onDismiss={onCancel}>
    <h2 id="edit-zone-colour-title" className={variants.dialog.title}>Color for {zoneName}</h2>
    <p className={`${variants.dialog.text} mb-4`}>A visual aid to tell zones apart. It is kept in this browser only and can be changed any time.</p>
    <div className="grid gap-[6px] min-[440px]:grid-cols-2">
      {zoneColourPalette.map((entry) => {
        const selected = current === entry.key;
        return <button
          key={entry.key}
          type="button"
          aria-pressed={selected}
          onClick={() => onPick(entry.key)}
          style={{ ...zoneTintStyle(entry.key), borderColor: "var(--zone-stroke)" }}
          className={`zone-tint flex min-h-[50px] items-center gap-2 border-[2px] px-3 py-2 text-left font-ui ${selected ? "bg-ink text-paper" : "bg-paper text-ink"}`}
        >
          <ZoneMarker colour={entry.key}/>
          <strong className="block text-[0.78rem] font-extrabold uppercase tracking-[0.06em]">{entry.label}</strong>
        </button>;
      })}
    </div>
    <div className={variants.dialog.actions}>
      <Button onClick={onCancel}>Cancel</Button>
      <Button variant="primary" disabled={current === undefined} onClick={() => onPick(null)}>No color</Button>
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
