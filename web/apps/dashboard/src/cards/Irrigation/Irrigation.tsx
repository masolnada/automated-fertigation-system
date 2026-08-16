import { useState } from "react";
import { Badge, Button, Card, CardTitle } from "@hort/ui";
import type { CycleRecipe, OutputChannel, ScheduleEntry, Zone } from "@hort/contracts";
import type { Snapshot } from "../../store";
import { NewIrrigation } from "./NewIrrigation/NewIrrigation";
import { ConfirmDeleteSchedule } from "./ConfirmDeleteSchedule/ConfirmDeleteSchedule";
import { channelName, frequencyText, recipeText } from "./schedule";

const icon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16.3c2.2 0 4-1.8 4-4 0-1.5-.7-2.6-2-3.8-.9-.8-1.7-2-2-3.5-.3 1.5-1.1 2.7-2 3.5-1.3 1.2-2 2.3-2 3.8 0 2.2 1.8 4 4 4z"/><path d="M16.8 20c2.3 0 4.2-1.9 4.2-4.2 0-1.6-.8-2.8-2.1-4-.9-.9-1.8-2.1-2.1-3.8-.3 1.7-1.2 2.9-2.1 3.8-1.3 1.2-2.1 2.4-2.1 4 0 2.3 1.9 4.2 4.2 4.2z"/></svg>;

/**
 * The device's default recipe: what the offline manual button waters with, and
 * what a new irrigation is proposed with. No longer what a commanded run uses —
 * that travels with the start (controller ADR-0018).
 */
function defaultRecipe(snapshot: Snapshot): CycleRecipe {
  const mode = snapshot.entities.default_cycle_mode?.value === "Volume" ? "Volume" : "Time";
  const total = Number(snapshot.entities[mode === "Volume" ? "default_cycle_liters" : "default_cycle_minutes"]?.value);
  const preWetPercent = Number(snapshot.entities["default_pre-wet_percent"]?.value);
  const flushMinutes = Number(snapshot.entities.default_flush_minutes?.value);
  return {
    mode,
    total: Number.isFinite(total) ? total : mode === "Volume" ? 100 : 25,
    preWetPercent: Number.isFinite(preWetPercent) ? preWetPercent : 20,
    flushMinutes: Number.isFinite(flushMinutes) ? flushMinutes : 5,
  };
}

function ScheduleList({ entries, zones, assignments, onDelete }: { entries: ScheduleEntry[]; zones: Zone[]; assignments: Record<number, string>; onDelete(entry: ScheduleEntry): void }) {
  if (entries.length === 0) return <p className="m-0 py-2 font-bold italic">No scheduled irrigations yet.</p>;
  return <ul className="m-0 list-none p-0">
    {entries.map((entry) => <li key={entry.id} className="flex items-center gap-4 border-b-[2px] border-dashed border-gray py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <strong className="block text-[0.95rem] font-extrabold">{channelName(zones, assignments, entry.channel)}</strong>
        <small className="block text-[0.75rem] font-bold">{entry.time} · {frequencyText(entry.frequency)}</small>
        <small className="block text-[0.72rem] font-bold">{recipeText(entry.recipe)}</small>
      </div>
      <Button variant="danger" className="h-[38px] px-4 text-[0.68rem]" onClick={() => onDelete(entry)}>Delete</Button>
    </li>)}
  </ul>;
}

type Props = {
  snapshot: Snapshot;
  onStart(channel: OutputChannel, recipe: CycleRecipe): void;
  onStop(): void;
  onSchedule(entry: { time: string; frequency: ScheduleEntry["frequency"]; channel: OutputChannel; recipe: CycleRecipe }): void;
  onDeleteSchedule(id: string): void;
};

/**
 * Standing irrigations and the one way to make another. The card lists what will
 * happen; everything that *decides* what happens lives in the wizard, so the
 * card holds no cycle controls — a run's recipe is an input to that run, not a
 * setting on this surface (controller ADR-0018).
 */
export function Irrigation({ snapshot, onStart, onStop, onSchedule, onDeleteSchedule }: Props) {
  const [creating, setCreating] = useState(false);
  // Remounted per opening, so an abandoned draft never resurfaces.
  const [run, setRun] = useState(0);
  const [deleting, setDeleting] = useState<ScheduleEntry | null>(null);
  const running = snapshot.entities.irrigation_running?.value === "ON";

  return <Card className="card-irrigation">
    <CardTitle icon={icon}>Irrigation <Badge state={running ? "on" : "off"}>{running ? "running" : "idle"}</Badge>
      <span>{running
        ? <Button variant="danger" className="h-[38px] px-4 text-[0.68rem]" onClick={onStop}>Stop irrigation</Button>
        : <Button variant="relay" onClick={() => { setRun((n) => n + 1); setCreating(true); }}>New irrigation</Button>}</span>
    </CardTitle>
    <ScheduleList entries={snapshot.schedules} zones={snapshot.zones} assignments={snapshot.assignments} onDelete={setDeleting}/>
    <NewIrrigation
      key={run}
      open={creating}
      zones={snapshot.zones}
      assignments={snapshot.assignments}
      defaults={defaultRecipe(snapshot)}
      openChannel={(snapshot.selectedOutput || 0) as OutputChannel | 0}
      schedules={snapshot.schedules}
      onStart={onStart}
      onSchedule={onSchedule}
      onClose={() => setCreating(false)}
    />
    <ConfirmDeleteSchedule
      entry={deleting}
      label={deleting ? channelName(snapshot.zones, snapshot.assignments, deleting.channel) : ""}
      onConfirm={() => { if (deleting) onDeleteSchedule(deleting.id); setDeleting(null); }}
      onCancel={() => setDeleting(null)}
    />
  </Card>;
}
