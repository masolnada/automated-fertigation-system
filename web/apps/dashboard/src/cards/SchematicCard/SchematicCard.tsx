import { useState } from "react";
import { Button, Card, CardTitle, Schematic, useSchematicSelection, type ZoneColour } from "@hort/ui";
import { outputChannels, sourceIds, type SourceId, type Zone } from "@hort/contracts";
import type { Snapshot } from "../../store";
import { useColourOf } from "../../zoneColours";
import { channelLabel, displayNumber } from "../../display";
import { assignIneligibleReason } from "../../guards";
import { ConfirmPumpStart } from "./ConfirmPumpStart/ConfirmPumpStart";
import { ConfirmTotalWaterReset } from "./ConfirmTotalWaterReset/ConfirmTotalWaterReset";
import { AssignEditor, type Assignments } from "./AssignEditor/AssignEditor";
import { FlowSettings } from "./FlowSettings/FlowSettings";

const icon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="9" width="6" height="6"/><rect x="16" y="9" width="6" height="6"/><path d="M8 12h8"/><circle cx="12" cy="12" r="2"/></svg>;

const SOURCE_LABELS: Record<SourceId, string> = { clean_water_valve: "Clean water", fertigation_valve: "Fertigation", microbiology_valve: "Microbiology" };

type Props = {
  snapshot: Snapshot;
  onSelectValve(valve: SourceId | ""): void;
  onSelectOutput(channel: number): void;
  onTogglePump(): void;
  onSetAssignments(next: Assignments): void;
  onMinFlow(value: number): void;
};

/**
 * The system diagram and the acts on it. The diagram carries no adjacent info
 * panel: selecting a node acts on it, and anything it needs to say opens as a
 * modal, so every edit on this card is one surface.
 *
 * Each output channel is labelled with the zone assigned to it, falling back to
 * the bare channel when nothing is (web ADR-0014) — an unassigned channel still
 * waters, its events simply record no zone.
 */
export function SchematicCard({ snapshot, onSelectValve, onSelectOutput, onTogglePump, onSetAssignments, onMinFlow }: Props) {
  const [selected, setSelected] = useSchematicSelection();
  const [confirming, setConfirming] = useState<"" | "pump" | "reset">("");
  const [editing, setEditing] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  const activeSource = sourceIds.find((id) => snapshot.valves[id]) ?? "";
  const pumpOn = snapshot.entities.pump?.value === "ON";
  const blockedReason = activeSource === "" && snapshot.selectedOutput === 0 ? "Open one source and one zone." : activeSource === "" ? "Open a source." : "Open a zone.";
  const assignBlocked = assignIneligibleReason(snapshot);

  const colourOf = useColourOf();
  const zoneById = (id: string | undefined): Zone | undefined => snapshot.zones.find((zone) => zone.id === id);
  const outputLabels: Record<number, string> = {};
  const outputZoneColours: Record<number, ZoneColour | undefined> = {};
  for (const channel of outputChannels) {
    const zone = zoneById(snapshot.assignments[channel]);
    outputLabels[channel] = zone?.name ?? channelLabel(channel);
    outputZoneColours[channel] = zone ? colourOf(zone) : undefined;
  }

  return <Card className="card-schematic">
    <CardTitle icon={icon}>System<span><Button variant="relay" disabled={Boolean(assignBlocked)} title={assignBlocked || undefined} onClick={() => setEditing(true)}>Edit</Button></span></CardTitle>
    <Schematic
      activeSource={activeSource}
      selectedOutput={snapshot.selectedOutput}
      pumpOn={pumpOn}
      flowRate={snapshot.entities.flow_rate?.known ? displayNumber(snapshot.entities.flow_rate.value, "flow_rate") : "–"}
      outputLabels={outputLabels}
      outputZoneColours={outputZoneColours}
      sourceLabels={SOURCE_LABELS}
      selected={selected}
      onSelect={(node) => { setSelected(node); if (node === "flow") setFlowOpen(true); }}
      onSelectSource={onSelectValve}
      onSelectOutput={onSelectOutput}
      onTogglePump={() => { if (pumpOn) onTogglePump(); else setConfirming("pump"); }}
      blockedReason={blockedReason}
    />
    <AssignEditor open={editing} zones={snapshot.zones} assignments={snapshot.assignments} schedules={snapshot.schedules} onSave={(next) => { onSetAssignments(next); setEditing(false); }} onClose={() => setEditing(false)}/>
    <FlowSettings open={flowOpen} snapshot={snapshot} onMinFlow={onMinFlow} onResetRequest={() => { setFlowOpen(false); setConfirming("reset"); }} onClose={() => setFlowOpen(false)}/>
    <ConfirmPumpStart open={confirming === "pump"} onConfirm={() => { onTogglePump(); setConfirming(""); }} onCancel={() => setConfirming("")}/>
    <ConfirmTotalWaterReset open={confirming === "reset"} snapshot={snapshot} onClose={() => setConfirming("")}/>
  </Card>;
}
