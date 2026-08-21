import { useEffect, useRef } from "react";
import { Button, Modal, variants } from "@hort/ui";
import type { CycleMode } from "@hort/contracts";
import type { Snapshot } from "../../../store";
import { useDebounced } from "../../../debounce";

/** The device owns each value: mirror it in unless the operator is mid-edit. */
function DeviceNumber({ label, id, value, open, min, max, step, onCommit }: { label: string; id: string; value: number | undefined; open: boolean; min: number; max: number; step: number; onCommit(value: number): void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (document.activeElement !== ref.current && ref.current) ref.current.value = value === undefined ? "" : String(value); }, [value, open]);
  const commit = useDebounced((raw: string) => { const n = Number(raw); if (raw.trim() !== "" && Number.isFinite(n)) onCommit(n); });
  return <label className={variants.durations.label}><span>{label}</span>
    <input ref={ref} className={variants.durations.input} aria-label={id} type="number" min={min} max={max} step={step} defaultValue={value === undefined ? "" : String(value)} onChange={(event) => commit(event.target.value)}/>
  </label>;
}

type Props = {
  open: boolean;
  snapshot: Snapshot;
  onCycleMode(mode: CycleMode): void;
  onCycleTarget(value: number): void;
  onPreWet(value: number): void;
  onFlush(value: number): void;
  onClose(): void;
};

/**
 * Device defaults used by the physical button and as the starting point for a
 * new irrigation. Commanded and scheduled runs still carry their own recipe.
 */
export function IrrigationSettings({ open, snapshot, onCycleMode, onCycleTarget, onPreWet, onFlush, onClose }: Props) {
  const mode = snapshot.entities.default_cycle_mode?.value === "Volume" ? "Volume" : "Time";
  const totalId = mode === "Volume" ? "default_cycle_liters" : "default_cycle_minutes";
  const number = (id: string) => (snapshot.entities[id]?.known ? Number(snapshot.entities[id]!.value) : undefined);

  return <Modal open={open} labelledBy="irrigation-settings-title" onDismiss={onClose}>
    <h2 id="irrigation-settings-title" className={variants.dialog.title}>Irrigation settings</h2>
    <h3 className="m-0 mb-1 text-[0.62rem] font-extrabold uppercase tracking-[0.1em]">Default recipe</h3>
    <p className="m-0 mb-4 text-[0.72rem] font-bold leading-snug">What the button on the box waters with, and what a new irrigation starts from.</p>
    <div className={variants.durations.container}>
      <label className={variants.durations.label}><span>Cycle mode</span>
        <select aria-label="Default cycle mode" className={variants.durations.input} value={mode} onChange={(event) => onCycleMode(event.target.value as CycleMode)}><option>Time</option><option>Volume</option></select>
      </label>
      <DeviceNumber label={mode === "Volume" ? "Cycle liters" : "Cycle minutes"} id={totalId} value={number(totalId)} open={open} min={0} max={mode === "Volume" ? 500 : 180} step={mode === "Volume" ? 0.5 : 1} onCommit={onCycleTarget}/>
      <DeviceNumber label="Pre-wet percent" id="default_pre-wet_percent" value={number("default_pre-wet_percent")} open={open} min={0} max={100} step={5} onCommit={onPreWet}/>
      <DeviceNumber label="Flush minutes" id="default_flush_minutes" value={number("default_flush_minutes")} open={open} min={1} max={60} step={1} onCommit={onFlush}/>
    </div>
    <div className={variants.dialog.actions}>
      <Button onClick={onClose}>Close</Button>
    </div>
  </Modal>;
}
