import { useEffect, useState } from "react";
import { Button, Modal, Select, variants } from "@hort/ui";
import { outputChannels, type Zone } from "@hort/contracts";
import { channelLabel } from "../../../display";

export type Assignments = Record<number, string | null>;

/**
 * Zones already on another channel are hidden rather than refused, so the table
 * cannot be put into a state the one-to-one rule forbids (web ADR-0014). An
 * unassignment and an assignment are both just dropdown changes in the same
 * save, so moving a zone between channels is one edit rather than two.
 */
function optionsFor(draft: Assignments, channel: number, liveZones: Zone[]) {
  const taken = new Set(outputChannels.filter((other) => other !== channel).map((other) => draft[other]).filter(Boolean));
  return [{ value: "", label: "— Unassigned —" }, ...liveZones.filter((zone) => !taken.has(zone.id)).map((zone) => ({ value: zone.id, label: zone.name }))];
}

const isDirty = (a: Assignments, b: Assignments) => outputChannels.some((channel) => (a[channel] ?? null) !== (b[channel] ?? null));

/**
 * The whole assignation table, edited and saved as a unit: one-to-one is a
 * table-level invariant, so a per-row save could pass through a state it
 * forbids, and every row must share one `valid_from` (web ADR-0014).
 *
 * No Confirmation — the table is on screen in full before the operator commits,
 * so the consequence is already visible, and the act is refused outright while
 * the pump runs rather than confirmed and then regretted.
 */
export function AssignEditor({ open, zones, assignments, onSave, onClose }: { open: boolean; zones: Zone[]; assignments: Record<number, string>; onSave(next: Assignments): void; onClose(): void }) {
  const [draft, setDraft] = useState<Assignments>({});
  // Seeded with every channel, absent ones included: the command carries the
  // whole table, so an unassigned channel must say so rather than be omitted.
  useEffect(() => {
    if (!open) return;
    setDraft(Object.fromEntries(outputChannels.map((channel) => [channel, assignments[channel] ?? null])));
  }, [open, assignments]);
  const liveZones = zones.filter((zone) => !zone.archived);
  const dirty = isDirty(assignments, draft);

  return <Modal open={open} labelledBy="assign-editor-title" onDismiss={onClose}>
    <h2 id="assign-editor-title" className={variants.dialog.title}>Zone assignments</h2>
    <p className={`${variants.dialog.text} mb-5`}>Each output channel feeds at most one zone, and each zone sits on at most one channel. This is the one place the two are named together — everywhere else the dashboard speaks zones.</p>
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="border-b-[2px] border-dashed border-gray pb-2 text-left text-[0.62rem] font-extrabold uppercase tracking-[0.1em]">Channel</th>
          <th className="border-b-[2px] border-dashed border-gray pb-2 text-left text-[0.62rem] font-extrabold uppercase tracking-[0.1em]">Zone</th>
        </tr>
      </thead>
      <tbody>
        {outputChannels.map((channel) => <tr key={channel}>
          <td className="border-b-[2px] border-dashed border-gray py-3 pr-4 text-[0.9rem] font-bold whitespace-nowrap">{channelLabel(channel)}</td>
          <td className="w-full border-b-[2px] border-dashed border-gray py-3">
            <Select label={`Zone for ${channelLabel(channel)}`} className="w-full" value={draft[channel] ?? ""} options={optionsFor(draft, channel, liveZones)} onChange={(value) => setDraft((current) => ({ ...current, [channel]: value || null }))}/>
          </td>
        </tr>)}
      </tbody>
    </table>
    <div className={variants.dialog.actions}>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" disabled={!dirty} onClick={() => onSave(draft)}>Save assignments</Button>
    </div>
  </Modal>;
}
