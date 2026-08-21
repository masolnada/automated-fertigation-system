import { useState } from "react";
import { Badge, Button, Card, CardTitle, ZoneMarker, variants } from "@hort/ui";
import { outputChannels, type Zone } from "@hort/contracts";
import { setZoneColour, useZoneColours } from "../../zoneColours";
import { ConfirmArchiveZone, CreateZone, EditZoneColour, RenameZone } from "./ZoneDialogs";

const icon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;

type Props = {
  zones: Zone[];
  assignments: Record<number, string>;
  onCreate(name: string): void | Promise<void>;
  onRename(id: string, name: string): void;
  onArchive(id: string): void;
  onUnarchive(id: string): void;
};

/**
 * The zone registry: what places exist, whatever the pump is doing. Assigning a
 * zone to a channel is the System card's job — this card owns identity and
 * lifecycle only (web ADR-0014).
 *
 * Archived zones are behind a toggle rather than gone: archiving takes a zone
 * out of the selectable list and preserves its history, so the list has to stay
 * reachable.
 */
export function Zones({ zones, assignments, onCreate, onRename, onArchive, onUnarchive }: Props) {
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState("");
  const [archiving, setArchiving] = useState("");
  const [colouring, setColouring] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const colours = useZoneColours();

  const channelOf = (id: string) => outputChannels.find((channel) => assignments[channel] === id) ?? null;
  const listed = zones.filter((zone) => zone.archived === showArchived);
  const renamingZone = zones.find((zone) => zone.id === renaming);
  const archivingZone = zones.find((zone) => zone.id === archiving);
  const colouringZone = zones.find((zone) => zone.id === colouring);

  return <Card className="card-zones">
    <CardTitle icon={icon}>Zones<span><Button variant="relay" onClick={() => setCreating(true)}>New zone</Button></span></CardTitle>
    <div className="mb-4 flex gap-[6px]">
      {([["Live", false], ["Archived", true]] as const).map(([label, archived]) => <button key={label} type="button" aria-pressed={showArchived === archived} onClick={() => setShowArchived(archived)} className={`${variants.valve.button} ${showArchived === archived ? variants.valve.active : variants.valve.inactive}`}>{label}</button>)}
    </div>
    <ul className={variants.relay.list}>
      {listed.map((zone) => {
        const channel = channelOf(zone.id);
        const colour = zone.archived ? undefined : colours[zone.id];
        return <li key={zone.id} className={`${variants.relay.row} flex-wrap`}>
          {colour ? <ZoneMarker colour={colour}/> : <span className="zone-marker" style={{ background: "var(--color-gray)" }} aria-hidden="true"/>}
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{zone.name}</span>
          <Badge state={channel ? "on" : "off"}>{channel ? "Assigned" : "Unassigned"}</Badge>
          {zone.archived
            ? <Button variant="relay" style={{ marginLeft: 0 }} onClick={() => onUnarchive(zone.id)}>Restore</Button>
            : <>
              <Button variant="relay" style={{ marginLeft: 0 }} aria-label={`Color for ${zone.name}`} onClick={() => setColouring(zone.id)}>Color</Button>
              <Button variant="relay" style={{ marginLeft: 0 }} onClick={() => setRenaming(zone.id)}>Rename</Button>
              <Button variant="relay" style={{ marginLeft: 0 }} onClick={() => setArchiving(zone.id)}>Archive</Button>
            </>}
        </li>;
      })}
      {listed.length === 0 ? <li className={variants.relay.row}><span className="italic">{showArchived ? "Nothing archived." : "No zones yet — create one to name a place that gets watered."}</span></li> : null}
    </ul>
    <CreateZone open={creating} onCreate={async (name) => { await onCreate(name); setCreating(false); }} onCancel={() => setCreating(false)}/>
    <EditZoneColour open={Boolean(colouringZone)} zoneName={colouringZone?.name ?? ""} current={colouring ? colours[colouring] : undefined} onPick={(colour) => { setZoneColour(colouring, colour); setColouring(""); }} onCancel={() => setColouring("")}/>
    <RenameZone open={Boolean(renamingZone)} current={renamingZone?.name ?? ""} onRename={(name) => { onRename(renaming, name); setRenaming(""); }} onCancel={() => setRenaming("")}/>
    <ConfirmArchiveZone open={Boolean(archivingZone)} name={archivingZone?.name ?? ""} channel={archivingZone ? channelOf(archivingZone.id) : null} onConfirm={() => { onArchive(archiving); setArchiving(""); }} onCancel={() => setArchiving("")}/>
  </Card>;
}
