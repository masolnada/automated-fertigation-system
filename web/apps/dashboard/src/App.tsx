import type { SnapshotStore } from "./store";
import { useStore } from "./useStore";
import { useSelectValve, useSelectZone, useSetCycleMode, useSetCycleTarget, useSetFlushDuration, useSetMinFlow, useSetPreWetPercent, useSetZoneName, useStartIrrigation, useStopIrrigation, useTogglePump } from "./commands";
import { Irrigation } from "./cards/Irrigation/Irrigation";
import { Battery } from "./cards/Battery";
import { SchematicCard } from "./cards/SchematicCard/SchematicCard";
import { Watering } from "./cards/Watering";
import { Events } from "./cards/Events";
import { HeaderStatus } from "./HeaderStatus";

export function App({ store }: { store: SnapshotStore }) {
  const snapshot = useStore(store);

  const start = useStartIrrigation();
  const stop = useStopIrrigation();
  const togglePump = useTogglePump();
  const selectValve = useSelectValve();
  const setCycleMode = useSetCycleMode();
  const setPreWet = useSetPreWetPercent();
  const setCycleTarget = useSetCycleTarget();
  const setFlush = useSetFlushDuration();
  const setMinFlow = useSetMinFlow();
  const selectZone = useSelectZone();
  const setZoneName = useSetZoneName();

  return <><header><nav className="pill-nav"><span className="logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg></span><div className="title"><h1>Hort</h1><span className="subtitle">automated fertigation</span></div><HeaderStatus status={{ deviceOnline: snapshot.deviceOnline, brokerConnected: snapshot.brokerConnected, serverConnected: snapshot.serverConnected }}/></nav></header><main><SchematicCard snapshot={snapshot} onSelectValve={(valve) => selectValve.mutate({ valve })} onSelectZone={(zone) => selectZone.mutate({ zone })} onTogglePump={() => togglePump.mutate({})} onZoneName={(zone, name) => setZoneName.mutate({ zone, name })} onMinFlow={(value) => setMinFlow.mutate({ value })}/><Watering pumpOn={snapshot.entities.pump?.value === "ON"} zoneNames={snapshot.zoneNames}/><Irrigation snapshot={snapshot} onStart={() => start.mutate({})} onStop={() => stop.mutate({})} onCycleMode={(mode) => setCycleMode.mutate({ mode })} onPreWet={(value) => setPreWet.mutate({ value })} onCycleTarget={(value) => setCycleTarget.mutate({ value })} onFlush={(value) => setFlush.mutate({ value })}/><Battery snapshot={snapshot}/><Events snapshot={snapshot}/></main></>;
}
