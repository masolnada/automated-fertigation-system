import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { sourceIds, zoneNumbers, type SourceId } from "@hort/contracts";
import { HoverDialog } from "./HoverDialog/HoverDialog";
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
 *   is marked in `warning` when it cannot run: an amber border and corner mark
 *   on the node, with the reason itself in a hover dialog.
 *
 * Geometry constants below drive both the box sizes and the SVG coordinates, so
 * connectors always meet box centres; changing a size keeps them aligned.
 *
 * Two layouts, one component. The left-to-right diagram needs a fixed 630 px of
 * width, so below that it is replaced — not shrunk — by a stacked pipeline that
 * reads top to bottom in the same order: source, pump, flow, zone. Scaling the
 * diagram down instead would make the boxes unreadable and untappable.
 */
export const SCHEMATIC_MIN_WIDTH = 1100;

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
  /** Why the pump cannot run, shown on the node when the path is shut. */
  blockedReason: string;
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

const DEADHEAD = "Running against a closed line deadheads the pump.";
const reasonSentence = (reason: string) => `${reason} ${DEADHEAD}`;

/**
 * The pump box plus its blocked-state dialog.
 *
 * The dialog is supplementary: a device with no pointer never opens it, so the
 * reason is also carried in the button's own accessible name.
 */
function PumpNode({ blocked, reason, children }: { blocked: boolean; reason: string; children: ReactElement }) {
  if (!blocked) return <div className="shrink-0">{children}</div>;
  return <HoverDialog
    placement="right"
    className="shrink-0"
    content={<><span className={variants.hoverDialog.title}>Pump cannot run</span><p className={variants.hoverDialog.body}>{reasonSentence(reason)}</p></>}
  >
    {children}
  </HoverDialog>;
}

/** True while the viewport is too narrow for the fixed-width diagram. */
function useNarrow(): boolean {
  const query = `(max-width: ${SCHEMATIC_MIN_WIDTH - 1}px)`;
  const [narrow, setNarrow] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches);
    setNarrow(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return narrow;
}

/** A vertical connector between two stacked bands, inked while a route runs through it. */
function Drop({ live, flowing }: { live: boolean; flowing: boolean }) {
  return <svg width={8} height={18} className="mx-auto shrink-0" aria-hidden="true">
    <line x1={4} y1={0} x2={4} y2={18} strokeWidth={3} stroke={IDLE}/>
    {live ? <line x1={4} y1={0} x2={4} y2={18} strokeWidth={3} stroke={WATER} strokeDasharray="8 4" data-motion={flowing ? "" : undefined} className={flowing ? variants.schematic.flowing : ""}/> : null}
  </svg>;
}

/**
 * Small-screen layout: the same system as four full-width bands, top to bottom
 * in flow order. Every control keeps a comfortable tap target instead of being
 * squeezed into a scaled-down diagram.
 */
function StackedPipeline({ activeSource, selectedZone, pumpOn, flowRate, zoneNames, sourceLabels, selected, onSelect, onSelectSource, onSelectZone, onTogglePump }: Omit<SchematicProps, "children">) {
  const open = hasOpenPath(activeSource, selectedZone);
  const flowing = pumpOn && open;
  const routeSelected = activeSource !== "" || selectedZone > 0;
  const s = variants.schematic;

  return <div className="grid">
    <span className={`${s.kicker} mb-[6px]`}>Source</span>
    <div className="grid grid-cols-3 gap-[6px]">
      {sourceIds.map((id) => {
        const on = activeSource === id;
        return <button key={id} type="button" aria-pressed={on} onClick={() => { onSelectSource(on ? "" : id); onSelect(id); }} className={`${s.stackCell} ${on ? s.boxOn : s.boxOff} ${selected === id ? s.stackSelected : ""}`}>
          <span className={s.stackLabel}>{sourceLabels[id]}</span>
          <b className={s.boxState}>{on ? "OPEN" : "SHUT"}</b>
        </button>;
      })}
    </div>

    <Drop live={activeSource !== ""} flowing={flowing}/>

    {/* The stacked layout keeps its inline caption: there is no pointer on a
        phone, so a hover dialog would hide the reason entirely. */}
    <button type="button" disabled={!pumpOn && !open} onClick={() => { onTogglePump(); onSelect("pump"); }} className={`${s.stackBand} ${open ? "border-ink" : "border-warning"} ${pumpOn ? s.boxOn : s.boxOff}`}>
      <span className={s.kicker}>Pump</span>
      <b className={`${s.nodeValue} ml-auto`}>{pumpOn ? "ON" : "OFF"}</b>
      {!open ? <span className={s.nodeWarn}>no path</span> : null}
    </button>

    <Drop live={routeSelected} flowing={flowing}/>

    <button type="button" onClick={() => onSelect("flow")} className={`${s.stackBand} border-ink ${s.boxOff} ${selected === "flow" ? s.stackSelected : ""}`}>
      <span className={s.kicker}>Flow</span>
      <b className={`${s.nodeValue} ml-auto`}>{flowRate}</b>
      <span className={s.nodeUnit}>L/min</span>
    </button>

    <Drop live={selectedZone > 0} flowing={flowing}/>

    <span className={`${s.kicker} mb-[6px]`}>Zone</span>
    <div className="grid grid-cols-2 gap-[6px]">
      {zoneNumbers.map((zone) => {
        const on = selectedZone === zone;
        return <button key={zone} type="button" aria-pressed={on} onClick={() => { onSelectZone(on ? 0 : zone); onSelect(`zone_${zone}`); }} className={`${s.stackCell} ${on ? s.boxOn : s.boxOff} ${selected === `zone_${zone}` ? s.stackSelected : ""}`}>
          <span className={s.stackLabel}>{zoneNames[zone] ?? `Zone ${zone}`}</span>
          <b className={s.boxState}>{on ? "OPEN" : "SHUT"}</b>
        </button>;
      })}
    </div>
  </div>;
}

export function Schematic(props: SchematicProps) {
  const { activeSource, selectedZone, pumpOn, flowRate, zoneNames, sourceLabels, selected, onSelect, onSelectSource, onSelectZone, onTogglePump, blockedReason, children } = props;
  const narrow = useNarrow();
  const open = hasOpenPath(activeSource, selectedZone);
  const flowing = pumpOn && open;
  const activeSourceIndex = sourceIds.findIndex((id) => id === activeSource);
  const activeZoneIndex = zoneNumbers.findIndex((zone) => zone === selectedZone);
  // The spine is shared by every route, so one open valve on either side lights it.
  const routeSelected = activeSourceIndex >= 0 || activeZoneIndex >= 0;
  const s = variants.schematic;

  if (narrow) return <div className="grid gap-5">
    <StackedPipeline {...props}/>
    <div aria-hidden="true" className="border-t-[2px] border-dashed border-gray"/>
    <aside className={s.panel}>{children}</aside>
  </div>;

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
          {/* The square must stay centred on SPINE_Y for the manifolds to meet
              it, so the blocked state is marked inside the box and explained in
              a hover dialog rather than by anything that changes its size. */}
          <PumpNode blocked={!open} reason={blockedReason}>
            <button type="button" style={{ width: NODE, height: NODE_H }} disabled={!pumpOn && !open} onClick={() => { onTogglePump(); onSelect("pump"); }} className={`${s.node} relative ${open ? "border-ink" : "border-warning"} ${pumpOn ? s.boxOn : s.boxOff}`}>
              <span className={s.kicker}>Pump</span>
              <b className={s.nodeValue}>{pumpOn ? "ON" : "OFF"}</b>
              {!open ? <span className={s.nodeWarnDot} aria-hidden="true"/> : null}
              {!open ? <span className={s.srOnly}>Cannot run. {reasonSentence(blockedReason)}</span> : null}
            </button>
          </PumpNode>
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
