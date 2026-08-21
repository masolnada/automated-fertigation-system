import { useState } from "react";
import { Badge, Button, Card, CardTitle, ZoneMarker, zoneTintStyle } from "@hort/ui";
import type { CycleMode, CycleRecipe, OutputChannel, ScheduleEntry, Zone } from "@hort/contracts";
import type { Snapshot } from "../../store";
import { useColourOf } from "../../zoneColours";
import { NewIrrigation } from "./NewIrrigation/NewIrrigation";
import { ConfirmDeleteSchedule } from "./ConfirmDeleteSchedule/ConfirmDeleteSchedule";
import { IrrigationSettings } from "./IrrigationSettings/IrrigationSettings";
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

function ScheduleList({ entries, zones, assignments, noZones, onDelete }: { entries: ScheduleEntry[]; zones: Zone[]; assignments: Record<number, string>; noZones: boolean; onDelete(entry: ScheduleEntry): void }) {
  const colourOf = useColourOf();
  if (entries.length === 0) return <p className="m-0 py-2 font-bold italic">{noZones ? "No zones yet. Create one before starting an irrigation." : "No scheduled irrigations yet."}</p>;
  return <ul className="m-0 list-none p-0">
    {entries.map((entry) => {
      // A schedule belongs to a channel, so it follows the Zone currently on
      // that channel and becomes uncoloured when the channel is bare.
      const zone = zones.find((candidate) => candidate.id === assignments[entry.channel]);
      const colour = zone ? colourOf(zone) : undefined;
      return <li key={entry.id} style={colour ? { ...zoneTintStyle(colour), borderLeft: "6px solid var(--zone-stroke)", paddingLeft: "0.75rem" } : undefined} className={`flex items-center gap-4 border-b-[2px] border-dashed border-gray py-3 last:border-b-0 ${colour ? "zone-tint" : ""}`}>
        {colour ? <ZoneMarker colour={colour}/> : null}
        <div className="min-w-0 flex-1">
          <strong className="block text-[0.95rem] font-extrabold">{channelName(zones, assignments, entry.channel)}</strong>
          <small className="block text-[0.75rem] font-bold">{entry.time} · {frequencyText(entry.frequency)}</small>
          <small className="block text-[0.72rem] font-bold">{recipeText(entry.recipe)}</small>
        </div>
        <Button variant="danger" className="h-[38px] px-4 text-[0.68rem]" onClick={() => onDelete(entry)}>Delete</Button>
      </li>;
    })}
  </ul>;
}

type Props = {
  snapshot: Snapshot;
  onStart(channel: OutputChannel, recipe: CycleRecipe): void;
  onStop(): void;
  onSchedule(entry: { time: string; frequency: ScheduleEntry["frequency"]; channel: OutputChannel; recipe: CycleRecipe }): void;
  onDeleteSchedule(id: string): void;
  onCycleMode(mode: CycleMode): void;
  onCycleTarget(value: number): void;
  onPreWet(value: number): void;
  onFlush(value: number): void;
};

/**
 * Standing irrigations, creation, and the device's irrigation defaults. A run's
 * recipe still lives in the wizard and travels with that run; settings only edit
 * what the physical button uses and what a new irrigation starts from.
 */
export function Irrigation({ snapshot, onStart, onStop, onSchedule, onDeleteSchedule, onCycleMode, onCycleTarget, onPreWet, onFlush }: Props) {
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Remounted per opening, so an abandoned draft never resurfaces.
  const [run, setRun] = useState(0);
  const [deleting, setDeleting] = useState<ScheduleEntry | null>(null);
  const running = snapshot.entities.irrigation_running?.value === "ON";
  // Seeded only when the open channel has a zone: the picker offers assigned
  // channels only, so an unassigned one would preselect nothing visible.
  const openChannel = (snapshot.assignments[snapshot.selectedOutput] ? snapshot.selectedOutput : 0) as OutputChannel | 0;
  // The button is about the operator-facing place, not its wiring: it is disabled
  // only when there are no live Zones. Assignment is a separate choice and, if
  // still missing, is explained on the Zone step rather than conflated here.
  const noZones = !snapshot.zones.some((zone) => !zone.archived);

  return <Card className="card-irrigation">
    <CardTitle icon={icon}>Irrigation <Badge state={running ? "on" : "off"}>{running ? "running" : "idle"}</Badge>
      <span className="flex gap-[6px] max-[640px]:basis-full max-[640px]:justify-end">{running
        ? <Button variant="danger" className="h-[38px] px-4 text-[0.68rem]" onClick={onStop}>Stop irrigation</Button>
        : <Button variant="relay" className="ml-0" disabled={noZones} onClick={() => { setRun((n) => n + 1); setCreating(true); }}>New irrigation</Button>}
        <Button variant="relay" className="ml-0 grid w-[38px] place-items-center !px-0 [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:stroke-[2.25]" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/></svg>
        </Button>
      </span>
    </CardTitle>
    <ScheduleList entries={snapshot.schedules} zones={snapshot.zones} assignments={snapshot.assignments} noZones={noZones} onDelete={setDeleting}/>
    <NewIrrigation
      key={run}
      open={creating}
      zones={snapshot.zones}
      assignments={snapshot.assignments}
      defaults={defaultRecipe(snapshot)}
      openChannel={openChannel}
      schedules={snapshot.schedules}
      onStart={onStart}
      onSchedule={onSchedule}
      onClose={() => setCreating(false)}
    />
    <IrrigationSettings
      open={settingsOpen}
      snapshot={snapshot}
      onCycleMode={onCycleMode}
      onCycleTarget={onCycleTarget}
      onPreWet={onPreWet}
      onFlush={onFlush}
      onClose={() => setSettingsOpen(false)}
    />
    <ConfirmDeleteSchedule
      entry={deleting}
      label={deleting ? channelName(snapshot.zones, snapshot.assignments, deleting.channel) : ""}
      onConfirm={() => { if (deleting) onDeleteSchedule(deleting.id); setDeleting(null); }}
      onCancel={() => setDeleting(null)}
    />
  </Card>;
}
