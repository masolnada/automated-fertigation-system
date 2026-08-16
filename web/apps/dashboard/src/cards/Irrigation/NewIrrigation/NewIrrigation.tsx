import { useState, type ReactNode } from "react";
import { Button, Modal, variants } from "@hort/ui";
import { type CycleMode, type CycleRecipe, type OutputChannel, type ScheduleEntry, type Zone } from "@hort/contracts";
import { slotTakenBy } from "../../../guards";
import { WEEKDAYS, channelName, draftBlocked, draftFrom, frequencyText, nextDates, recipeUnit, todayISO, waterableChannels, type Draft } from "../schedule";

const heading = "m-0 mb-3 text-[0.72rem] font-extrabold uppercase tracking-[0.14em]";
const fieldRow = "grid grid-cols-[minmax(0,1fr)_minmax(6.8rem,9rem)_2.5rem] items-center gap-2 text-[0.9rem] font-bold";
const field = "h-[46px] w-full border-[2px] border-ink bg-paper px-[0.6rem] text-center font-num text-[1.05rem] font-extrabold text-ink";
const section = "border-[2px] border-ink p-4";
const toggle = (on: boolean) => `border-[2px] border-ink font-ui font-extrabold ${on ? "bg-ink text-paper" : "bg-paper text-ink"}`;

/**
 * Proportional phase blocks, so the planned sequence is legible before it runs.
 * Flush is fixed-width because it is always minutes: sizing it against a volume
 * total would compare litres to minutes.
 */
function PhaseBars({ recipe }: { recipe: CycleRecipe }) {
  const unit = recipeUnit(recipe);
  const phases = [
    { id: "pre-wet", name: "Pre-wet", value: (recipe.total * recipe.preWetPercent) / 100, unit, grow: Math.max(recipe.preWetPercent, 5) },
    { id: "fertigation", name: "Fertigation", value: (recipe.total * (100 - recipe.preWetPercent)) / 100, unit, grow: Math.max(100 - recipe.preWetPercent, 5) },
    { id: "flush", name: "Flush", value: recipe.flushMinutes, unit: "min", grow: 0 },
  ];
  return <div className="flex min-w-0 gap-[6px] border-t-[2px] border-dashed border-gray pt-5" aria-label="Irrigation sequence overview">
    {phases.map((phase) => <div key={phase.id} className={`flex min-w-0 flex-col justify-center border-[2px] border-ink px-3 py-2 ${phase.id === "fertigation" ? "bg-ink text-paper" : "bg-paper text-ink"}${phase.grow === 0 ? " w-[6.5rem] shrink-0" : ""}`} style={{ flexGrow: phase.grow || undefined, flexBasis: phase.grow ? 0 : undefined }}>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.66rem] font-extrabold uppercase tracking-[0.1em]">{phase.name}</span>
      <b className={`font-num font-extrabold leading-[1.3] ${phase.id === "fertigation" ? "text-[2.25rem]" : "text-[1.4rem]"}`}>{Math.round(phase.value * 10) / 10}<small className="ml-1 font-ui text-[0.65rem] font-extrabold tracking-[0.06em]">{phase.unit}</small></b>
    </div>)}
  </div>;
}

function StepRecipe({ recipe, onChange }: { recipe: CycleRecipe; onChange(next: Partial<CycleRecipe>): void }) {
  const unit = recipeUnit(recipe);
  return <div className="grid gap-[6px] min-[720px]:grid-cols-3 min-[720px]:[&>*:last-child]:col-span-3">
    <section className={section}>
      <h3 className={heading}>Cycle</h3>
      <div className="grid gap-3">
        <label className={fieldRow}><span>Cycle Mode</span>
          <select aria-label="Cycle Mode" className={field} value={recipe.mode} onChange={(event) => onChange({ mode: event.target.value as CycleMode })}><option>Time</option><option>Volume</option></select>
          <span aria-hidden="true"></span></label>
        <label className={fieldRow}><span>{recipe.mode === "Volume" ? "Cycle Liters" : "Cycle Minutes"}</span>
          <input className={field} type="number" min={0} max={recipe.mode === "Volume" ? 500 : 180} step={recipe.mode === "Volume" ? 0.5 : 1} value={recipe.total} onChange={(event) => onChange({ total: Number(event.target.value) })}/>
          <span>{unit}</span></label>
      </div>
    </section>
    <section className={section}>
      <h3 className={heading}>Pre-wet allocation</h3>
      <div className="grid grid-cols-3 gap-[6px]">{[0, 5, 10, 15, 20, 25].map((value) => <button key={value} type="button" aria-pressed={value === recipe.preWetPercent} onClick={() => onChange({ preWetPercent: value })} className={`h-[46px] text-[0.9rem] ${toggle(value === recipe.preWetPercent)}`}>{value}%</button>)}</div>
    </section>
    <section className={section}>
      <h3 className={heading}>Flush</h3>
      <label className={fieldRow}><span>Flush Minutes</span>
        <input className={field} type="number" min={1} max={60} step={1} value={recipe.flushMinutes} onChange={(event) => onChange({ flushMinutes: Number(event.target.value) })}/>
        <span>min</span></label>
    </section>
    <PhaseBars recipe={recipe}/>
  </div>;
}

/**
 * Zones only — a channel with no zone is not offered. Scheduling water to a bare
 * "Output 3" would name a place the system cannot name, and the resulting event
 * would resolve to no zone (web ADR-0016).
 *
 * The card is enabled when a live zone exists, independently of wiring. If none
 * of those zones is assigned yet, this step explains the missing prerequisite.
 */
function StepZone({ draft, zones, assignments, onChange }: { draft: Draft; zones: Zone[]; assignments: Record<number, string>; onChange(next: Partial<Draft>): void }) {
  const channels = waterableChannels(assignments);
  return <section className={section}>
    <h3 className={heading}>Zone</h3>
    {channels.length === 0
      ? <p className="m-0 text-[0.85rem] font-bold leading-snug">No zone is assigned to an output yet. Assign one on the System card before starting an irrigation.</p>
      : <div className="grid grid-cols-2 gap-[6px] min-[720px]:grid-cols-4">
          {channels.map((channel) => <button key={channel} type="button" aria-pressed={channel === draft.channel} onClick={() => onChange({ channel: channel as OutputChannel })} className={`flex min-h-[52px] flex-col justify-center px-2 py-1 text-left ${toggle(channel === draft.channel)}`}>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.8rem]">{channelName(zones, assignments, channel)}</span>
          </button>)}
        </div>}
  </section>;
}

function StepSchedule({ draft, onChange, taken }: { draft: Draft; onChange(next: Partial<Draft>): void; taken: string }) {
  const { frequency } = draft;
  const toggleDay = (day: number) => {
    if (frequency.kind !== "weekdays") return;
    onChange({ frequency: { kind: "weekdays", days: frequency.days.includes(day) ? frequency.days.filter((d) => d !== day) : [...frequency.days, day] } });
  };
  return <div className={`grid gap-[6px] ${draft.when === "future" ? "min-[720px]:grid-cols-[13rem_13rem_minmax(0,1fr)]" : ""}`}>
    <section className={section}>
      <h3 className={heading}>When</h3>
      <div className="grid grid-cols-2 gap-[6px]">
        {(["now", "future"] as const).map((value) => <button key={value} type="button" aria-pressed={draft.when === value} onClick={() => onChange({ when: value, ...(value === "future" && !draft.time ? { time: "06:00" } : {}) })} className={`h-[46px] text-[0.8rem] uppercase tracking-[0.08em] ${toggle(draft.when === value)}`}>{value === "now" ? "Now" : "Schedule"}</button>)}
      </div>
    </section>
    {draft.when === "future" ? <>
      <section className={section}>
        <h3 className={heading}>Time of day</h3>
        <input aria-label="Time of day" type="time" className={field} value={draft.time} onChange={(event) => onChange({ time: event.target.value })}/>
      </section>
      <section className={`${section} min-w-0`}>
        <h3 className={heading}>Frequency</h3>
        <div className="mb-3 grid max-w-[26rem] grid-cols-2 gap-[6px]">
          <button type="button" aria-pressed={frequency.kind === "weekdays"} onClick={() => onChange({ frequency: { kind: "weekdays", days: [2] } })} className={`h-[38px] text-[0.68rem] uppercase tracking-[0.08em] ${toggle(frequency.kind === "weekdays")}`}>Days of week</button>
          <button type="button" aria-pressed={frequency.kind === "everyN"} onClick={() => onChange({ frequency: { kind: "everyN", n: 3, from: todayISO() } })} className={`h-[38px] text-[0.68rem] uppercase tracking-[0.08em] ${toggle(frequency.kind === "everyN")}`}>Every N days</button>
        </div>
        {frequency.kind === "weekdays"
          ? <div className="grid grid-cols-7 gap-[4px]">{WEEKDAYS.map((label, index) => <button key={label} type="button" aria-pressed={frequency.days.includes(index + 1)} aria-label={label} onClick={() => toggleDay(index + 1)} className={`h-[44px] text-[0.62rem] uppercase ${toggle(frequency.days.includes(index + 1))}`}>{label[0]}</button>)}</div>
          : <div className="grid gap-3">
              <label className={fieldRow}><span>Every</span><input className={field} type="number" min={1} max={90} value={frequency.n} onChange={(event) => onChange({ frequency: { ...frequency, n: Number(event.target.value) } })}/><span>days</span></label>
              <label className={fieldRow}><span>Starting</span><input className={field} type="date" value={frequency.from} onChange={(event) => onChange({ frequency: { ...frequency, from: event.target.value } })}/><span aria-hidden="true"></span></label>
            </div>}
        <p className="m-0 mt-3 border-t-[2px] border-dashed border-gray pt-3 text-[0.78rem] font-bold leading-snug">Next: {nextDates(frequency, draft.time).join(" · ") || "—"}</p>
        {/* One pump: a second entry due at the same moment would be dropped as a
            skipped run, so the clash is shown here rather than discovered later. */}
        {taken ? <p className="m-0 mt-3 border-[2px] border-warning p-2 text-[0.72rem] font-bold leading-snug text-warning">{draft.time} is already taken by {taken}. Pick another time or another day.</p> : null}
      </section>
    </> : null}
  </div>;
}

/**
 * The step band doubles as the restatement: each step collapses, as it is left,
 * into its own answer, so the operator never commits without seeing what they
 * said. The step they are *on* shows only its name — restating a control an inch
 * below it would be a speed bump, not a check.
 *
 * A completed step is a button, which is the affordance a summary implies: read
 * it, disagree, click it.
 */
function StepBand({ labels, answers, current, onGo }: { labels: string[]; answers: string[]; current: number; onGo(step: number): void }) {
  return <ol className="m-0 mb-5 grid list-none gap-[6px] p-0 min-[560px]:grid-flow-col min-[560px]:auto-cols-fr">
    {labels.map((label, index) => {
      const done = index < current;
      const here = index === current;
      return <li key={label} className="min-w-0">
        <button type="button" disabled={!done} onClick={() => onGo(index)} className={`flex min-h-[52px] w-full flex-col justify-center border-[2px] px-3 py-1 text-left ${here ? "border-ink bg-ink text-paper" : done ? "cursor-pointer border-ink bg-paper text-ink" : "border-gray bg-paper text-gray"}`}>
          <span className="text-[0.56rem] font-extrabold uppercase tracking-[0.1em]">{index + 1}. {label}</span>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.8rem] font-extrabold">{here ? "\u00a0" : answers[index] || "—"}</span>
        </button>
      </li>;
    })}
  </ol>;
}

type Props = {
  open: boolean;
  zones: Zone[];
  assignments: Record<number, string>;
  defaults: CycleRecipe;
  openChannel: OutputChannel | 0;
  schedules: ScheduleEntry[];
  onStart(channel: OutputChannel, recipe: CycleRecipe): void;
  onSchedule(entry: { time: string; frequency: Draft["frequency"]; channel: OutputChannel; recipe: CycleRecipe }): void;
  onClose(): void;
};

/**
 * The one surface for starting or scheduling an irrigation. Three steps, and the
 * last one is the Confirmation rather than a dialog stacked on top of it: the
 * operator has just stated every consequential input and the band above restates
 * the ones now off screen, which is what the confirmation rule is for.
 *
 * The height is fixed so moving between steps shifts nothing (DESIGN.md §3), and
 * the whole wizard is remounted per opening, so a new irrigation always starts
 * from the defaults rather than from whatever was abandoned last time.
 */
export function NewIrrigation({ open, zones, assignments, defaults, openChannel, schedules, onStart, onSchedule, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => draftFrom(defaults, openChannel));
  const change = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));
  const changeRecipe = (next: Partial<CycleRecipe>) => setDraft((current) => ({ ...current, recipe: { ...current.recipe, ...next } }));

  const labels = ["Cycle", "Zone", "Schedule"];
  const answers = [
    `${draft.recipe.total} ${recipeUnit(draft.recipe)} · ${draft.recipe.preWetPercent}% · ${draft.recipe.flushMinutes}m`,
    draft.channel ? channelName(zones, assignments, draft.channel) : "",
    draft.when === "" ? "" : draft.when === "now" ? "Immediately" : `${draft.time} · ${frequencyText(draft.frequency)}`,
  ];
  const taken = draft.when === "future" && draft.time ? slotTakenBy(schedules, draft, (channel) => channelName(zones, assignments, channel)) : "";
  const blocked = step === 1 && !draft.channel ? "Choose a zone"
    : step === 2 ? draftBlocked(draft) || (taken ? `${draft.time} is already taken by ${taken}` : "")
    : "";

  const commit = () => {
    if (!draft.channel || draft.when === "") return;
    if (draft.when === "now") onStart(draft.channel, draft.recipe);
    else onSchedule({ time: draft.time, frequency: draft.frequency, channel: draft.channel, recipe: draft.recipe });
    onClose();
  };

  const body: ReactNode = step === 0 ? <StepRecipe recipe={draft.recipe} onChange={changeRecipe}/>
    : step === 1 ? <StepZone draft={draft} zones={zones} assignments={assignments} onChange={change}/>
    : <StepSchedule draft={draft} onChange={change} taken={taken}/>;

  return <Modal open={open} wide labelledBy="new-irrigation-title" onDismiss={onClose}>
    <div className="flex h-[70vh] max-h-[46rem] min-h-[30rem] flex-col">
      <h2 id="new-irrigation-title" className={variants.dialog.title}>New irrigation</h2>
      <StepBand labels={labels} answers={answers} current={step} onGo={setStep}/>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      <div className={variants.dialog.actions}>
        <Button onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>{step === 0 ? "Cancel" : "Back"}</Button>
        {step < 2
          ? <Button variant="primary" disabled={Boolean(blocked)} title={blocked || undefined} onClick={() => setStep(step + 1)}>Next</Button>
          : <Button variant="primary" disabled={Boolean(blocked)} title={blocked || undefined} onClick={commit}>{draft.when === "now" ? "Start irrigation" : "Schedule irrigation"}</Button>}
      </div>
    </div>
  </Modal>;
}
