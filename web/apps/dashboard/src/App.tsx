import { useEffect, useState } from "react";
import { Badge, Dialog } from "@hort/ui";
import type { SnapshotStore } from "./store";
import { useStore } from "./useStore";
import { canReset, resetIneligibleReason } from "./guards";
import { resetMessages } from "./display";
import { CommandFailure, useResetTotalWater, useSelectValve, useSetCycleMode, useSetCycleTarget, useSetFlushDuration, useSetMinFlow, useSetPreWetPercent, useStartIrrigation, useStopIrrigation, useTogglePump } from "./commands";
import { Irrigation } from "./cards/Irrigation";
import { Battery } from "./cards/Battery";
import { Relays } from "./cards/Relays";
import { Flow } from "./cards/Flow";
import { Events } from "./cards/Events";

type DialogKind = "" | "start" | "pump" | "reset";

export function App({ store }: { store: SnapshotStore }) {
  const snapshot = useStore(store);
  const [kind, setKind] = useState<DialogKind>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [opener, setOpener] = useState<HTMLElement | null>(null);

  const start = useStartIrrigation();
  const stop = useStopIrrigation();
  const togglePump = useTogglePump();
  const selectValve = useSelectValve();
  const setCycleMode = useSetCycleMode();
  const setPreWet = useSetPreWetPercent();
  const setCycleTarget = useSetCycleTarget();
  const setFlush = useSetFlushDuration();
  const setMinFlow = useSetMinFlow();
  const reset = useResetTotalWater();

  const reason = resetIneligibleReason(snapshot);
  const pending = kind === "reset" && reset.isPending;

  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && menuOpen) { event.preventDefault(); setMenuOpen(false); } }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [menuOpen]);

  const close = (force = false) => { if (pending && !force) return; reset.reset(); setKind(""); setStatus(""); setError(false); opener?.focus(); };
  const open = (next: DialogKind, event?: React.MouseEvent<HTMLElement> | HTMLElement | null) => { setOpener(event instanceof HTMLElement ? event : event?.currentTarget ?? (document.activeElement as HTMLElement)); setKind(next); setStatus(""); setError(false); };

  const showResult = (code: string | undefined) => { const [message, severity] = resetMessages[code ?? ""] ?? [`Unexpected reset response: ${code}.`, "danger"]; setStatus(message); setError(severity === "danger"); if (severity === "normal") close(true); };
  const confirm = () => {
    if (kind === "start") { start.mutate({}); close(true); return; }
    if (kind === "pump") { togglePump.mutate({}); close(true); return; }
    if (!canReset(snapshot)) { setStatus(`Reset unavailable: ${reason}.`); setError(true); return; }
    setStatus("Waiting for device…"); setError(false);
    reset.mutate({}, { onSuccess: (data) => showResult(data.result), onError: (err) => { const failure = err as CommandFailure; if (failure.result) showResult(failure.result); else { setStatus(`Reset unavailable: ${failure.reason ?? failure.message}.`); setError(true); } } });
  };

  const message = kind === "pump" ? "If it starts, make sure a valve is open." : kind === "start" ? "Start the irrigation sequence?" : `This will reset the total from ${Number(snapshot.entities.total_water?.value).toFixed(1)} L to 0 L. This action cannot be undone.`;
  return <><header><nav className="pill-nav"><span className="logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg></span><div className="title"><h1>Hort</h1><span className="subtitle">automated fertigation</span></div><Badge state={snapshot.deviceOnline ? "online" : "offline"}>{snapshot.deviceOnline ? "online" : "offline"}</Badge><span id="broker-status"><Badge state={snapshot.brokerConnected ? "online" : "offline"}>broker: {snapshot.brokerConnected ? "connected" : "connecting…"}</Badge></span><span id="server-status"><Badge state={snapshot.serverConnected ? "online" : "offline"}>server: {snapshot.serverConnected ? "connected" : "connecting…"}</Badge></span></nav></header><main><Irrigation snapshot={snapshot} onStart={() => open("start")} onStop={() => stop.mutate({})} onCycleMode={(mode) => setCycleMode.mutate({ mode })} onPreWet={(value) => setPreWet.mutate({ value })} onCycleTarget={(value) => setCycleTarget.mutate({ value })} onFlush={(value) => setFlush.mutate({ value })}/><Battery snapshot={snapshot}/><Relays snapshot={snapshot} onPump={() => open("pump")} onSelectValve={(valve) => selectValve.mutate({ valve })}/><Flow snapshot={snapshot} reason={reason} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onMinFlow={(value) => setMinFlow.mutate({ value })} onReset={(opener) => open("reset", opener)}/><Events snapshot={snapshot}/></main><Dialog open={Boolean(kind)} title={kind === "pump" ? "Toggle pump?" : kind === "start" ? "Start irrigation?" : "Reset total water?"} message={message} status={status || (!pending && kind === "reset" && reason ? `Reset unavailable: ${reason}.` : "")} danger={kind === "reset" || error} pending={pending} confirmText={kind === "pump" ? "Toggle pump" : kind === "start" ? "Start irrigation" : "Reset total"} confirmDisabled={kind === "reset" && !pending && !canReset(snapshot)} onConfirm={confirm} onClose={() => close()} opener={opener}/></>;
}
