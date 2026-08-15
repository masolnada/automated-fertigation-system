import { useEffect, useRef } from "react";
import { Button, Modal, variants } from "@hort/ui";
import type { Snapshot } from "../../../store";
import { displayNumber } from "../../../display";
import { useDebounced } from "../../../debounce";
import { resetIneligibleReason } from "../../../guards";

/**
 * The flow sensor's readings and its two controls. The schematic is a diagram
 * with no adjacent info panel, so selecting the flow node opens this instead —
 * selecting a node still acts on it, and every edit on the System card is a
 * modal. Not a Confirmation: it guards nothing and its own destructive control
 * opens one of its own.
 */
export function FlowSettings({ open, snapshot, onMinFlow, onResetRequest, onClose }: { open: boolean; snapshot: Snapshot; onMinFlow(value: number): void; onResetRequest(): void; onClose(): void }) {
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
    <div className="mt-5 border-t-[2px] border-dashed border-gray pt-4">
      <Button variant="danger" className="w-full" disabled={Boolean(resetReason)} onClick={onResetRequest}>Reset total water</Button>
      {resetReason ? <p className="m-0 mt-2 text-[0.62rem] font-extrabold uppercase tracking-[0.06em]">{resetReason}</p> : null}
    </div>
    <div className={variants.dialog.actions}>
      <Button onClick={onClose}>Close</Button>
    </div>
  </Modal>;
}
