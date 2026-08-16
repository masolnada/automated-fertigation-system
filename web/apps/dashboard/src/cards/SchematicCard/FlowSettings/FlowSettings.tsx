import { useEffect, useRef } from "react";
import { Button, Modal, variants } from "@hort/ui";
import type { CycleMode } from "@hort/contracts";
import type { Snapshot } from "../../../store";
import { displayNumber } from "../../../display";
import { useDebounced } from "../../../debounce";
import { resetIneligibleReason } from "../../../guards";

/**
 * The device's default recipe: what the physical button waters with when there
 * is no network to carry one, and the values a new irrigation opens with. Not
 * what a commanded or scheduled run uses — those carry their own (controller
 * ADR-0018), which is why this lives here among the device's own settings
 * rather than on the Irrigation card.
 */
function DefaultRecipe({ snapshot, open, onCycleMode, onCycleTarget, onPreWet, onFlush }: { snapshot: Snapshot; open: boolean } & Pick<Props, "onCycleMode" | "onCycleTarget" | "onPreWet" | "onFlush">) {
  const mode = snapshot.entities.cycle_mode?.value === "Volume" ? "Volume" : "Time";
  const totalId = mode === "Volume" ? "cycle_liters" : "cycle_minutes";
  const number = (id: string) => (snapshot.entities[id]?.known ? Number(snapshot.entities[id]!.value) : undefined);
  return <section className="mt-5 border-t-[2px] border-dashed border-gray pt-4">
    <h3 className="m-0 mb-1 text-[0.62rem] font-extrabold uppercase tracking-[0.1em]">Default recipe</h3>
    <p className="m-0 mb-3 text-[0.72rem] font-bold leading-snug">What the button on the box waters with, and what a new irrigation starts from.</p>
    <div className={variants.durations.container}>
      <label className={variants.durations.label}><span>Cycle mode</span>
        <select aria-label="Default cycle mode" className={variants.durations.input} value={mode} onChange={(event) => onCycleMode(event.target.value as CycleMode)}><option>Time</option><option>Volume</option></select>
      </label>
      <DeviceNumber label={mode === "Volume" ? "Cycle liters" : "Cycle minutes"} id={totalId} value={number(totalId)} open={open} min={0} max={mode === "Volume" ? 500 : 180} step={mode === "Volume" ? 0.5 : 1} onCommit={onCycleTarget}/>
      <DeviceNumber label="Pre-wet percent" id="pre-wet_percent" value={number("pre-wet_percent")} open={open} min={0} max={100} step={5} onCommit={onPreWet}/>
      <DeviceNumber label="Flush minutes" id="flush_minutes" value={number("flush_minutes")} open={open} min={1} max={60} step={1} onCommit={onFlush}/>
    </div>
  </section>;
}

/** The device owns the value: mirror it in unless the operator is mid-edit. */
function DeviceNumber({ label, id, value, open, min, max, step, onCommit }: { label: string; id: string; value: number | undefined; open: boolean; min: number; max: number; step: number; onCommit(value: number): void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (document.activeElement !== ref.current && ref.current) ref.current.value = value === undefined ? "" : String(value); }, [value, open]);
  const commit = useDebounced((raw: string) => { const n = Number(raw); if (raw.trim() !== "" && Number.isFinite(n)) onCommit(n); });
  return <label className={variants.durations.label}><span>{label}</span>
    <input ref={ref} className={variants.durations.input} aria-label={id} type="number" min={min} max={max} step={step} defaultValue={value === undefined ? "" : String(value)} onChange={(event) => commit(event.target.value)}/>
  </label>;
}

/**
 * The flow sensor's readings and its two controls. The schematic is a diagram
 * with no adjacent info panel, so selecting the flow node opens this instead —
 * selecting a node still acts on it, and every edit on the System card is a
 * modal. Not a Confirmation: it guards nothing and its own destructive control
 * opens one of its own.
 */
type Props = {
  open: boolean;
  snapshot: Snapshot;
  onMinFlow(value: number): void;
  onCycleMode(mode: CycleMode): void;
  onCycleTarget(value: number): void;
  onPreWet(value: number): void;
  onFlush(value: number): void;
  onResetRequest(): void;
  onClose(): void;
};

export function FlowSettings({ open, snapshot, onMinFlow, onCycleMode, onCycleTarget, onPreWet, onFlush, onResetRequest, onClose }: Props) {
  const resetReason = resetIneligibleReason(snapshot);
  const value = (id: string) => (snapshot.entities[id]?.known ? displayNumber(snapshot.entities[id]!.value, id) : "–");
  const minFlow = snapshot.entities.min_flow?.known ? Number(snapshot.entities.min_flow.value) : undefined;
  const minFlowRef = useRef<HTMLInputElement>(null);
  // The device is the authority on this value: mirror it in unless the operator
  // is mid-edit, exactly as the panel did.
  useEffect(() => { if (document.activeElement !== minFlowRef.current && minFlowRef.current) minFlowRef.current.value = minFlow === undefined ? "" : String(minFlow); }, [minFlow, open]);
  const commitMinFlow = useDebounced((raw: string) => { const n = Number(raw); if (raw.trim() !== "" && Number.isFinite(n)) onMinFlow(n); });

  return <Modal open={open} labelledBy="flow-settings-title" onDismiss={onClose}>
    <h2 id="flow-settings-title" className={variants.dialog.title}>Flow sensor</h2>
    <dl className={variants.metric.list}>
      <div className={variants.metric.row}><dt className={variants.metric.term}>Flow rate</dt><dd className={variants.metric.definition}><span className={variants.metric.value}>{value("flow_rate")}</span><i className={variants.metric.unit}>L/min</i></dd></div>
      <div className={variants.metric.row}><dt className={variants.metric.term}>Total water</dt><dd className={variants.metric.definition}><span className={variants.metric.value}>{value("total_water")}</span><i className={variants.metric.unit}>L</i></dd></div>
    </dl>
    <label className={`${variants.durations.label} mt-4`}>Min flow
      <input ref={minFlowRef} className={variants.durations.input} aria-label="Min Flow" type="number" min="0" max="10" step="0.1" defaultValue={minFlow === undefined ? "" : String(minFlow)} onChange={(event) => commitMinFlow(event.target.value)}/>
    </label>
    <DefaultRecipe snapshot={snapshot} open={open} onCycleMode={onCycleMode} onCycleTarget={onCycleTarget} onPreWet={onPreWet} onFlush={onFlush}/>
    <div className="mt-5 border-t-[2px] border-dashed border-gray pt-4">
      <Button variant="danger" className="w-full" disabled={Boolean(resetReason)} onClick={onResetRequest}>Reset total water</Button>
      {resetReason ? <p className="m-0 mt-2 text-[0.62rem] font-extrabold uppercase tracking-[0.06em]">{resetReason}</p> : null}
    </div>
    <div className={variants.dialog.actions}>
      <Button onClick={onClose}>Close</Button>
    </div>
  </Modal>;
}
