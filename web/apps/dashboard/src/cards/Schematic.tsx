import { useEffect, useRef, useState } from "react";
import { Button, Card, CardTitle, Dialog, Schematic, hasOpenPath, useSchematicSelection, variants } from "@hort/ui";
import { sourceIds, type SourceId } from "@hort/contracts";
import type { Snapshot } from "../store";
import { displayNumber } from "../display";
import { useDebounced } from "../debounce";

const icon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="9" width="6" height="6"/><rect x="16" y="9" width="6" height="6"/><path d="M8 12h8"/><circle cx="12" cy="12" r="2"/></svg>;

const SOURCE_LABELS: Record<SourceId, string> = { clean_water_valve: "Clean water", fertigation_valve: "Fertigation", microbiology_valve: "Microbiology" };
const ZONE_NAME_MAX = 40;

/**
 * Renaming a zone is a confirmed, two-step action: the name is stamped onto
 * watering history as of when each event ran (web ADR-0010), so a rename splits
 * that zone's history across two labels. Typing alone changes nothing.
 */
function ZoneName({ zone, name, onRename }: { zone: number; name: string; onRename(zone: number, name: string): void }) {
  const [draft, setDraft] = useState(name);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setDraft(name); setConfirming(false); }, [name, zone]);
  const trimmed = draft.trim();
  const changed = trimmed !== "" && trimmed !== name && trimmed.length <= ZONE_NAME_MAX;

  return <div className="grid gap-[6px]">
    <span className={variants.schematic.fieldLabel}>Zone name</span>
    <input className={variants.schematic.fieldInput} value={draft} maxLength={ZONE_NAME_MAX} aria-label={`Name for zone ${zone}`} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && changed) setConfirming(true); }}/>
    <Button variant="primary" className="w-full" style={{ marginTop: 6, height: 40, paddingInline: 8, fontSize: "0.68rem" }} disabled={!changed} onClick={() => setConfirming(true)}>Rename</Button>
    <p className={`${variants.schematic.note} mt-1`}>Tap the box to open or shut this zone; only one zone is open at a time.</p>
    <Dialog
      open={confirming}
      title="Rename this zone?"
      message={`“${name}” becomes “${trimmed}”. Watering history keeps the name each event was recorded under, so past waterings stay labelled “${name}” and only new ones use “${trimmed}”. This zone's history will read under two names, which makes it harder to track.`}
      danger
      confirmText="Rename zone"
      onConfirm={() => { onRename(zone, trimmed); setConfirming(false); }}
      onClose={() => setConfirming(false)}
    />
  </div>;
}

type Props = {
  snapshot: Snapshot;
  resetReason: string;
  onSelectValve(valve: SourceId | ""): void;
  onSelectZone(zone: number): void;
  onTogglePump(): void;
  onZoneName(zone: number, name: string): void;
  onMinFlow(value: number): void;
  onReset(opener: HTMLElement | null): void;
};

export function SchematicCard({ snapshot, resetReason, onSelectValve, onSelectZone, onTogglePump, onZoneName, onMinFlow, onReset }: Props) {
  const [selected, setSelected] = useSchematicSelection();
  const resetRef = useRef<HTMLButtonElement>(null);
  const activeSource = sourceIds.find((id) => snapshot.valves[id]) ?? "";
  const value = (id: string) => (snapshot.entities[id]?.known ? displayNumber(snapshot.entities[id]!.value, id) : "–");
  const minFlow = snapshot.entities.min_flow?.known ? Number(snapshot.entities.min_flow.value) : undefined;
  const minFlowRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (document.activeElement !== minFlowRef.current && minFlowRef.current) minFlowRef.current.value = minFlow === undefined ? "" : String(minFlow); }, [minFlow]);
  const commitMinFlow = useDebounced((raw: string) => { const n = Number(raw); if (raw.trim() !== "" && Number.isFinite(n)) onMinFlow(n); });

  const open = hasOpenPath(activeSource, snapshot.selectedZone);
  const zone = selected.startsWith("zone_") ? Number(selected.slice(5)) : 0;
  const s = variants.schematic;
  const title = selected === "flow" ? "Flow sensor" : selected === "pump" ? "Pump" : zone ? snapshot.zoneNames[zone] ?? `Zone ${zone}` : SOURCE_LABELS[selected as SourceId] ?? "";

  return <Card className="card-schematic"><CardTitle icon={icon}>System</CardTitle>
    <Schematic
      activeSource={activeSource}
      selectedZone={snapshot.selectedZone}
      pumpOn={snapshot.entities.pump?.value === "ON"}
      flowRate={value("flow_rate")}
      zoneNames={snapshot.zoneNames}
      sourceLabels={SOURCE_LABELS}
      selected={selected}
      onSelect={setSelected}
      onSelectSource={onSelectValve}
      onSelectZone={onSelectZone}
      onTogglePump={onTogglePump}
    >
      <span className={s.panelTitle}>{title}</span>
      {/* Pinned regardless of selection: the interlock blocks the whole system,
          so it must not depend on the pump box being the selected node. */}
      {!open ? <div className={s.warn}>
        <span className={s.warnTitle}>Pump cannot run</span>
        <p className="m-0 mt-1 text-[0.76rem] font-bold leading-snug">{activeSource === "" && snapshot.selectedZone === 0 ? "Open one source and one zone." : activeSource === "" ? "Open a source." : "Open a zone."} Running against a closed line deadheads the pump.</p>
      </div> : null}
      <div className="pt-3">
        {selected === "flow" ? <div className="grid gap-2">
          <dl className={variants.metric.list}>
            <div className={variants.metric.row}><dt className={variants.metric.term}>Flow rate</dt><dd className={variants.metric.definition}><span className="font-num text-[1.1rem] font-extrabold tabular-nums">{value("flow_rate")}</span><i className={variants.metric.unit}>L/min</i></dd></div>
            <div className={variants.metric.row}><dt className={variants.metric.term}>Total</dt><dd className={variants.metric.definition}><span className="font-num text-[1.1rem] font-extrabold tabular-nums">{value("total_water")}</span><i className={variants.metric.unit}>L</i></dd></div>
          </dl>
          <label className={variants.durations.label}>Min flow <input ref={minFlowRef} className={`${variants.durations.input} h-[38px] w-[4.4rem]`} aria-label="Min Flow" type="number" min="0" max="10" step="0.1" defaultValue={minFlow === undefined ? "" : String(minFlow)} onChange={(event) => commitMinFlow(event.target.value)}/></label>
          <Button ref={resetRef} variant="danger" className="w-full" style={{ height: 40, paddingInline: 12, fontSize: "0.7rem" }} disabled={Boolean(resetReason)} onClick={() => onReset(resetRef.current)}>Reset total water</Button>
          {resetReason ? <p className="m-0 text-[0.62rem] font-extrabold uppercase tracking-[0.06em]">{resetReason}</p> : null}
        </div> : null}
        {selected === "pump" ? <p className={s.note}>{open ? "Path is open; the pump may run." : "The pump needs one open source and one open zone."}</p> : null}
        {zone ? <ZoneName zone={zone} name={snapshot.zoneNames[zone] ?? `Zone ${zone}`} onRename={onZoneName}/> : null}
        {sourceIds.includes(selected as SourceId) ? <p className={s.note}>Fixed in firmware. Exactly one source is open at a time.</p> : null}
      </div>
    </Schematic>
  </Card>;
}
