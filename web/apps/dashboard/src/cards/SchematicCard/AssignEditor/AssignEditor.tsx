import { useEffect, useState } from "react";
import { Button, Modal, Select, variants } from "@hort/ui";
import { outputChannels, type ScheduleEntry, type Zone } from "@hort/contracts";
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
 * A schedule names a channel, not a zone, because the controller fires it
 * offline and a channel is all it can honour (web ADR-0017). So moving a zone
 * off a channel silently redirects every schedule standing on it — the water
 * keeps flowing, to somewhere else. That consequence is invisible in the click,
 * which is exactly what the Confirmation rule exists for, so the editor says it
 * before the save rather than after.
 */
function redirected(current: Record<number, string>, draft: Assignments, schedules: ScheduleEntry[], zones: Zone[]): Array<{ channel: number; from: string; to: string; count: number }> {
  const name = (id: string | null) => zones.find((zone) => zone.id === id)?.name ?? null;
  return outputChannels.flatMap((channel) => {
    const before = current[channel] ?? null;
    const after = draft[channel] ?? null;
    if (before === after) return [];
    const count = schedules.filter((entry) => entry.channel === channel).length;
    if (count === 0) return [];
    return [{ channel, from: name(before) ?? channelLabel(channel), to: name(after) ?? `nothing (${channelLabel(channel)})`, count }];
  });
}

/**
 * The whole assignation table, edited and saved as a unit: one-to-one is a
 * table-level invariant, so a per-row save could pass through a state it
 * forbids, and every row must share one `valid_from` (web ADR-0014).
 *
 * No Confirmation for the table itself — it is on screen in full before the
 * operator commits, so the consequence is already visible, and the act is
 * refused outright while the pump runs rather than confirmed and then regretted.
 * The one consequence the table does *not* show is what happens to the schedules
 * standing on a channel that moves, so that is called out inline.
 */
export function AssignEditor({ open, zones, assignments, schedules, onSave, onClose }: { open: boolean; zones: Zone[]; assignments: Record<number, string>; schedules: ScheduleEntry[]; onSave(next: Assignments): void; onClose(): void }) {
  const [draft, setDraft] = useState<Assignments>({});
  // Seeded with every channel, absent ones included: the command carries the
  // whole table, so an unassigned channel must say so rather than be omitted.
  useEffect(() => {
    if (!open) return;
    setDraft(Object.fromEntries(outputChannels.map((channel) => [channel, assignments[channel] ?? null])));
  }, [open, assignments]);
  const liveZones = zones.filter((zone) => !zone.archived);
  const dirty = isDirty(assignments, draft);
  const moved = redirected(assignments, draft, schedules, zones);

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
    {moved.length ? <div className="mt-5 border-[2px] border-warning p-3">
      <strong className="block text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-warning">Scheduled irrigations move too</strong>
      <ul className="m-0 mt-2 list-none p-0">
        {moved.map((change) => <li key={change.channel} className="text-[0.78rem] font-bold leading-snug">
          {change.count} {change.count === 1 ? "schedule" : "schedules"} on {channelLabel(change.channel)} will water {change.to} instead of {change.from}.
        </li>)}
      </ul>
    </div> : null}
    <div className={variants.dialog.actions}>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" disabled={!dirty} onClick={() => onSave(draft)}>Save assignments</Button>
    </div>
  </Modal>;
}
