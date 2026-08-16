import type { SnapshotStore } from "./store";
import { useStore } from "./useStore";
import { useArchiveZone, useCreateSchedule, useCreateZone, useDeleteSchedule, useRenameZone, useSelectOutput, useSelectValve, useSetAssignments, useSetCycleMode, useSetCycleTarget, useSetFlushDuration, useSetMinFlow, useSetPreWetPercent, useStartIrrigation, useStopIrrigation, useTogglePump, useUnarchiveZone } from "./commands";
import { Irrigation } from "./cards/Irrigation/Irrigation";
import { Battery } from "./cards/Battery";
import { SchematicCard } from "./cards/SchematicCard/SchematicCard";
import { Zones } from "./cards/Zones/Zones";
import { Watering } from "./cards/Watering";
import { Events } from "./cards/Events";
import { HeaderStatus } from "./HeaderStatus";
import { ThemeToggle } from "@hort/ui";

export function App({ store }: { store: SnapshotStore }) {
  const snapshot = useStore(store);

  const start = useStartIrrigation();
  const stop = useStopIrrigation();
  const togglePump = useTogglePump();
  const selectValve = useSelectValve();
  const setMinFlow = useSetMinFlow();
  const setCycleMode = useSetCycleMode();
  const setCycleTarget = useSetCycleTarget();
  const setPreWet = useSetPreWetPercent();
  const setFlush = useSetFlushDuration();
  const selectOutput = useSelectOutput();
  const setAssignments = useSetAssignments();
  const createZone = useCreateZone();
  const renameZone = useRenameZone();
  const archiveZone = useArchiveZone();
  const unarchiveZone = useUnarchiveZone();
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();

  return <><header><nav className="pill-nav"><span className="logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg></span><div className="title"><h1>Hort</h1><span className="subtitle">automated fertigation</span></div><HeaderStatus status={{ deviceOnline: snapshot.deviceOnline, brokerConnected: snapshot.brokerConnected, serverConnected: snapshot.serverConnected }}/><ThemeToggle/></nav></header><main><SchematicCard snapshot={snapshot} onSelectValve={(valve) => selectValve.mutate({ valve })} onSelectOutput={(channel) => selectOutput.mutate({ channel })} onTogglePump={() => togglePump.mutate({})} onSetAssignments={(assignments) => setAssignments.mutate({ assignments })} onMinFlow={(value) => setMinFlow.mutate({ value })} onCycleMode={(mode) => setCycleMode.mutate({ mode })} onCycleTarget={(value) => setCycleTarget.mutate({ value })} onPreWet={(value) => setPreWet.mutate({ value })} onFlush={(value) => setFlush.mutate({ value })}/><Zones zones={snapshot.zones} assignments={snapshot.assignments} onCreate={(name) => createZone.mutate({ name })} onRename={(id, name) => renameZone.mutate({ id, name })} onArchive={(id) => archiveZone.mutate({ id })} onUnarchive={(id) => unarchiveZone.mutate({ id })}/><Irrigation snapshot={snapshot} onStart={(channel, recipe) => start.mutate({ channel, recipe })} onStop={() => stop.mutate({})} onSchedule={(entry) => createSchedule.mutate(entry)} onDeleteSchedule={(id) => deleteSchedule.mutate({ id })}/><Watering pumpOn={snapshot.entities.pump?.value === "ON"} zones={snapshot.zones}/><Battery snapshot={snapshot}/><Events snapshot={snapshot}/></main></>;
}
