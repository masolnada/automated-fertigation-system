import { useState } from "react";
import type { ReactNode } from "react";
import { sourceIds, zoneNumbers, type SourceId } from "@hort/contracts";
import { variants } from "./theme/variants";

/**
 * The system diagram: sources → pump → flow sensor → zones, drawn left to right
 * in the direction water flows. Presentational only — every value and callback
 * arrives as a prop, so it can be reused wherever the same shape is available.
 *
 * Two rules from the domain are drawn rather than described:
 * - exactly one source and one zone are open at a time, so the live route is a
 *   single continuous path;
 * - the pump needs an open path on both sides (controller ADR-0016), so the box
 *   is marked when it cannot run.
 *
 * Geometry constants below drive both the box sizes and the SVG coordinates, so
 * connectors always meet box centres; changing a size keeps them aligned.
 */

export type SchematicNode = SourceId | "pump" | "flow" | `zone_${number}`;

export type SchematicProps = {
  activeSource: SourceId | "";
  selectedZone: number;
  pumpOn: boolean;
  flowRate: string;
  zoneNames: Record<number, string>;
  sourceLabels: Record<SourceId, string>;
  selected: SchematicNode;
  onSelect(node: SchematicNode): void;
  onSelectSource(source: SourceId | ""): void;
  onSelectZone(zone: number): void;
  onTogglePump(): void;
  /** Rendered in the info panel beside the diagram. */
  children?: ReactNode;
};

const COL_W = 148, SRC_H = 54, ZONE_H = 58, GAP = 20, CONN_W = 64, BUS = 32, NODE = 86, NODE_H = 74, MID_PIPE = 34;
const SRC_TOTAL = sourceIds.length * SRC_H + (sourceIds.length - 1) * GAP;
const ZONE_TOTAL = zoneNumbers.length * ZONE_H + (zoneNumbers.length - 1) * GAP;
const DIAGRAM_H = Math.max(SRC_TOTAL, ZONE_TOTAL);
const SRC_TOP = (DIAGRAM_H - SRC_TOTAL) / 2;
const SPINE_Y = DIAGRAM_H / 2;
const srcY = (index: number) => SRC_TOP + index * (SRC_H + GAP) + SRC_H / 2;
const zoneY = (index: number) => index * (ZONE_H + GAP) + ZONE_H / 2;

const IDLE = "var(--color-gray)";
const WATER = "var(--color-water)";

/** Water blue while a route is selected; moving only while flow is live. */
function Route({ d, flowing }: { d: string; flowing: boolean }) {
  return <path d={d} fill="none" stroke={WATER} strokeWidth={3} strokeLinecap="butt" strokeLinejoin="miter" strokeDasharray="8 4" data-motion={flowing ? "" : undefined} className={flowing ? variants.schematic.flowing : ""}/>;
}

function SourceManifold({ activeIndex, flowing }: { activeIndex: number; flowing: boolean }) {
  return <svg width={CONN_W} height={DIAGRAM_H} className="shrink-0" aria-hidden="true">
    {sourceIds.map((id, index) => <line key={id} x1={0} y1={srcY(index)} x2={BUS} y2={srcY(index)} stroke={IDLE} strokeWidth={3}/>)}
    <line x1={BUS} y1={srcY(0)} x2={BUS} y2={srcY(sourceIds.length - 1)} stroke={IDLE} strokeWidth={3}/>
    <line x1={BUS} y1={SPINE_Y} x2={CONN_W} y2={SPINE_Y} stroke={IDLE} strokeWidth={3}/>
    {activeIndex >= 0 ? <Route d={`M 0 ${srcY(activeIndex)} H ${BUS} V ${SPINE_Y} H ${CONN_W}`} flowing={flowing}/> : null}
  </svg>;
}

function ZoneManifold({ activeIndex, flowing }: { activeIndex: number; flowing: boolean }) {
  return <svg width={CONN_W} height={DIAGRAM_H} className="shrink-0" aria-hidden="true">
    <line x1={0} y1={SPINE_Y} x2={BUS} y2={SPINE_Y} stroke={IDLE} strokeWidth={3}/>
    <line x1={BUS} y1={zoneY(0)} x2={BUS} y2={zoneY(zoneNumbers.length - 1)} stroke={IDLE} strokeWidth={3}/>
    {zoneNumbers.map((zone, index) => <line key={zone} x1={BUS} y1={zoneY(index)} x2={CONN_W} y2={zoneY(index)} stroke={IDLE} strokeWidth={3}/>)}
    {activeIndex >= 0 ? <Route d={`M 0 ${SPINE_Y} H ${BUS} V ${zoneY(activeIndex)} H ${CONN_W}`} flowing={flowing}/> : null}
  </svg>;
}

export const hasOpenPath = (activeSource: string, selectedZone: number) => activeSource !== "" && selectedZone > 0;

export function Schematic({ activeSource, selectedZone, pumpOn, flowRate, zoneNames, sourceLabels, selected, onSelect, onSelectSource, onSelectZone, onTogglePump, children }: SchematicProps) {
  const open = hasOpenPath(activeSource, selectedZone);
  const flowing = pumpOn && open;
  const activeSourceIndex = sourceIds.findIndex((id) => id === activeSource);
  const activeZoneIndex = zoneNumbers.findIndex((zone) => zone === selectedZone);
  // The spine is shared by every route, so one open valve on either side lights it.
  const routeSelected = activeSourceIndex >= 0 || activeZoneIndex >= 0;
  const s = variants.schematic;

  return <div className="grid gap-6 min-[1100px]:grid-cols-[auto_1px_232px]">
    <div className="justify-self-center">
      <div className="flex" style={{ marginBottom: 8 }}>
        <span className={s.kicker} style={{ width: COL_W }}>Sources</span>
        <span style={{ width: CONN_W * 2 + NODE * 2 + MID_PIPE }}/>
        <span className={s.kicker} style={{ width: COL_W }}>Zones</span>
      </div>

      <div className="flex" style={{ height: DIAGRAM_H }}>
        <div className="flex flex-col shrink-0" style={{ width: COL_W, gap: GAP, marginTop: SRC_TOP }}>
          {sourceIds.map((id) => {
            const on = activeSource === id;
            return <button key={id} type="button" style={{ height: SRC_H }} aria-pressed={on} onClick={() => { onSelectSource(on ? "" : id); onSelect(id); }} className={`${s.box} ${on ? s.boxOn : s.boxOff}`}>
              <span className={s.boxLabel}>{sourceLabels[id]}</span>
              <b className={s.boxState}>{on ? "OPEN" : "SHUT"}</b>
            </button>;
          })}
        </div>

        <SourceManifold activeIndex={activeSourceIndex} flowing={flowing}/>

        <div className="flex items-center shrink-0" style={{ height: DIAGRAM_H }}>
          <button type="button" style={{ width: NODE, height: NODE_H }} onClick={() => { onTogglePump(); onSelect("pump"); }} className={`${s.node} ${open ? "border-ink" : "border-danger"} ${pumpOn ? s.boxOn : s.boxOff}`}>
            <span className={s.kicker}>Pump</span>
            <b className={s.nodeValue}>{pumpOn ? "ON" : "OFF"}</b>
            {!open ? <span className={s.nodeWarn}>no path</span> : null}
          </button>
          <svg width={MID_PIPE} height={8} className="shrink-0" aria-hidden="true">
            <line x1={0} y1={4} x2={MID_PIPE} y2={4} strokeWidth={3} stroke={IDLE}/>
            {routeSelected ? <line x1={0} y1={4} x2={MID_PIPE} y2={4} strokeWidth={3} stroke={WATER} strokeDasharray="8 4" data-motion={flowing ? "" : undefined} className={flowing ? s.flowing : ""}/> : null}
          </svg>
          <button type="button" style={{ width: NODE, height: NODE_H }} onClick={() => onSelect("flow")} className={`${s.node} border-ink ${s.boxOff}`}>
            <span className={s.kicker}>Flow</span>
            <b className={s.nodeValue}>{flowRate}</b>
            <span className={s.nodeUnit}>L/min</span>
          </button>
        </div>

        <ZoneManifold activeIndex={activeZoneIndex} flowing={flowing}/>

        <div className="flex flex-col shrink-0" style={{ width: COL_W, gap: GAP }}>
          {zoneNumbers.map((zone) => {
            const on = selectedZone === zone;
            return <button key={zone} type="button" style={{ height: ZONE_H }} aria-pressed={on} onClick={() => { onSelectZone(on ? 0 : zone); onSelect(`zone_${zone}`); }} className={`${s.box} ${on ? s.boxOn : s.boxOff}`}>
              <span className={s.boxLabel}>{zoneNames[zone] ?? `Zone ${zone}`}</span>
              <b className={s.boxState}>{on ? "OPEN" : "SHUT"}</b>
            </button>;
          })}
        </div>
      </div>
    </div>

    <div aria-hidden="true" className={s.divider}/>
    <aside className={s.panel}>{children}</aside>
  </div>;
}

/** Selection state for the diagram, defaulting to the flow sensor. */
export function useSchematicSelection(initial: SchematicNode = "flow") {
  return useState<SchematicNode>(initial);
}
