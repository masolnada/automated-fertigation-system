import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Badge, Button, Card, CardTitle, variants } from "@hort/ui";
import type { CycleMode } from "@hort/contracts";
import type { Snapshot } from "../../store";
import { useDebounced } from "../../debounce";
import { ConfirmStartIrrigation } from "./ConfirmStartIrrigation/ConfirmStartIrrigation";

const icon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16.3c2.2 0 4-1.8 4-4 0-1.5-.7-2.6-2-3.8-.9-.8-1.7-2-2-3.5-.3 1.5-1.1 2.7-2 3.5-1.3 1.2-2 2.3-2 3.8 0 2.2 1.8 4 4 4z"/><path d="M16.8 20c2.3 0 4.2-1.9 4.2-4.2 0-1.6-.8-2.8-2.1-4-.9-.9-1.8-2.1-2.1-3.8-.3 1.7-1.2 2.9-2.1 3.8-1.3 1.2-2.1 2.4-2.1 4 0 2.3 1.9 4.2 4.2 4.2z"/></svg>;

type Phase = { id: string; name: string; value?: number; unit: "min" | "L" };

function NumberInput({ label, unit, min, max, step, value, onCommit, className, inputStyle }: { label: string; unit: string; min: number; max: number; step: number; value: number | string | undefined; onCommit(value: number): void; className?: string; inputStyle?: CSSProperties }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (document.activeElement !== ref.current && ref.current) ref.current.value = value === undefined ? "" : String(value); }, [value]);
  const commit = useDebounced((raw: string) => { const n = Number(raw); if (raw.trim() !== "" && Number.isFinite(n)) onCommit(n); });
  return <label className={className ?? variants.durations.label}><span>{label}</span><input ref={ref} className={variants.durations.input} style={inputStyle} type="number" min={min} max={max} step={step} defaultValue={value === undefined ? "" : String(value)} onChange={(event) => commit(event.target.value)} /><span>{unit}</span></label>;
}

function PresetGrid({ percent, onChange }: { percent: number; onChange(value: number): void }) {
  return <div className="grid grid-cols-3 gap-[6px]">{[0, 5, 10, 15, 20, 25].map((value) => <button key={value} aria-pressed={value === percent} onClick={() => onChange(value)} className={`h-[46px] border-[2px] border-ink font-ui text-[0.9rem] font-extrabold ${value === percent ? "bg-ink text-paper" : "bg-paper text-ink"}`}>{value}%</button>)}</div>;
}

// Proportional phase blocks make the planned sequence legible at a glance.
// min-w-0 permits the text to truncate inside narrow cards instead of overflowing.
function SequenceOverview({ phases, percent }: { phases: Phase[]; percent: number }) {
  return <div className="irrigation-sequence-overview mt-5 border-t-[2px] border-dashed border-gray pt-5" aria-label="Irrigation sequence overview">
    <div className="flex min-w-0 gap-[6px]">
      {phases.map((phase, index) => {
        const fertigation = phase.id === "fertigation";
        const flush = phase.id === "flush";
        const value = Number.isFinite(phase.value) ? phase.value : "–";
        return <div key={phase.id} className={`flex min-w-0 flex-col justify-center border-[2px] border-ink px-3 py-2 ${fertigation ? "bg-ink text-paper" : "bg-paper text-ink"}${flush ? "w-[6.5rem] shrink-0" : ""}`} style={{ flexGrow: flush ? undefined : Math.max(index === 0 ? percent : 100 - percent, 5), flexBasis: flush ? undefined : 0 }}>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.66rem] font-extrabold uppercase tracking-[0.1em]">{phase.name}</span>
          <b className={`font-num font-extrabold leading-[1.3] ${fertigation ? "text-[2.25rem]" : "text-[1.4rem]"}`}>{value}<small className="ml-1 font-ui text-[0.65rem] font-extrabold tracking-[0.06em]">{phase.unit}</small></b>
        </div>;
      })}
    </div>
  </div>;
}

type Props = { snapshot: Snapshot; onStart(): void; onStop(): void; onCycleMode(mode: CycleMode): void; onPreWet(value: number): void; onCycleTarget(value: number): void; onFlush(value: number): void };

export function Irrigation({ snapshot, onStart, onStop, onCycleMode, onPreWet, onCycleTarget, onFlush }: Props) {
  const [confirming, setConfirming] = useState(false);
  const mode = snapshot.entities.cycle_mode?.value === "Volume" ? "Volume" : "Time";
  const totalId = mode === "Volume" ? "cycle_liters" : "cycle_minutes";
  const total = Number(snapshot.entities[totalId]?.value);
  const prewet = Number(snapshot.entities["pre-wet_percent"]?.value);
  const percent = Number.isFinite(prewet) ? prewet : 20;
  const unit: "L" | "min" = mode === "Volume" ? "L" : "min";
  const running = snapshot.entities.irrigation_running?.value === "ON";
  const phaseValue = (share: number) => Number.isFinite(total) ? total * share : undefined;
  const phases: Phase[] = [
    { id: "pre-wet", name: "Pre-wet", value: phaseValue(percent / 100), unit },
    { id: "fertigation", name: "Fertigation", value: phaseValue(1 - percent / 100), unit },
    { id: "flush", name: "Flush", value: Number(snapshot.entities.flush_minutes?.value), unit: "min" },
  ];
  const cycleField = "grid grid-cols-[minmax(0,1fr)_6.8rem_2.5rem] items-center gap-2 text-[0.9rem] font-bold [&>input]:ml-0";
  const cycleFieldWidth = { width: "6.8rem" };
  const modeControl = <label className={cycleField}><span>Cycle Mode</span><select aria-label="Cycle Mode" className={variants.durations.input} style={cycleFieldWidth} value={mode} onChange={(event) => onCycleMode(event.target.value as CycleMode)}><option>Time</option><option>Volume</option></select><span aria-hidden="true"></span></label>;
  const targetControl = <NumberInput className={cycleField} label={mode === "Volume" ? "Cycle Liters" : "Cycle Minutes"} unit={unit} min={0} max={mode === "Volume" ? 500 : 180} step={mode === "Volume" ? 0.5 : 1} value={snapshot.entities[totalId]?.known ? snapshot.entities[totalId]!.value : undefined} onCommit={onCycleTarget} inputStyle={cycleFieldWidth} />;
  const flushControl = <NumberInput label="Flush Minutes" unit="min" min={1} max={60} step={1} value={snapshot.entities.flush_minutes?.known ? snapshot.entities.flush_minutes!.value : undefined} onCommit={onFlush} />;

  return <Card className="card-irrigation card-irrigation-horizontal">
    <CardTitle icon={icon}>Irrigation <Badge state={running ? "on" : "off"}>{running ? "running" : "idle"}</Badge></CardTitle>
    <div className="irrigation-programme-tiles grid grid-cols-1 gap-[6px]">
      <section className="border-[2px] border-ink p-4"><h3 className="m-0 mb-4 text-[0.72rem] font-extrabold uppercase tracking-[0.14em]">Cycle</h3><div className="grid gap-3">{modeControl}{targetControl}</div></section>
      <section className="border-[2px] border-ink p-4"><h3 className="mb-3 text-[0.72rem] font-extrabold uppercase tracking-[0.14em]">Pre-wet allocation</h3><PresetGrid percent={percent} onChange={onPreWet} /></section>
      <section className="border-[2px] border-ink p-4"><h3 className="m-0 mb-4 text-[0.72rem] font-extrabold uppercase tracking-[0.14em]">Flush</h3>{flushControl}</section>
      <SequenceOverview phases={phases} percent={percent} />
      <div className="irrigation-programme-actions mt-4">{running ? <Button className="w-full min-[900px]:w-auto" variant="danger" onClick={onStop}>Stop irrigation</Button> : <Button className="w-full min-[900px]:w-auto" variant="primary" onClick={() => setConfirming(true)}>Start irrigation</Button>}</div>
    </div>
    <ConfirmStartIrrigation open={confirming} onConfirm={() => { onStart(); setConfirming(false); }} onCancel={() => setConfirming(false)}/>
  </Card>;
}
