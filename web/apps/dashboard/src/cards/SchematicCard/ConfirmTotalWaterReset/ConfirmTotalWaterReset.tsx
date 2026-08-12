import { useState } from "react";
import { ConfirmDialog } from "@hort/ui";
import { CommandFailure, useResetTotalWater } from "../../../commands";
import { resetMessages } from "../../../display";
import { canReset, resetIneligibleReason } from "../../../guards";
import type { Snapshot } from "../../../store";

/**
 * The reset waits on the device and reports what it said (web ADR-0006), so it
 * stays open while in flight and on failure — the result line is the only place
 * the operator learns what happened to the total. The client-side guard dims the
 * affordance only; the server is the enforcing authority.
 */
export function ConfirmTotalWaterReset({ open, snapshot, onClose }: { open: boolean; snapshot: Snapshot; onClose(): void }) {
  const reset = useResetTotalWater();
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const pending = reset.isPending;
  const reason = resetIneligibleReason(snapshot);

  const close = () => { reset.reset(); setStatus(""); setFailed(false); onClose(); };

  const report = (code: string | undefined) => {
    const [message, severity] = resetMessages[code ?? ""] ?? [`Unexpected reset response: ${code}.`, "danger"];
    if (severity === "normal") { close(); return; }
    setStatus(message); setFailed(true);
  };

  const confirm = () => {
    if (!canReset(snapshot)) { setStatus(`Reset unavailable: ${reason}.`); setFailed(true); return; }
    setStatus("Waiting for device…"); setFailed(false);
    reset.mutate({}, {
      onSuccess: (data) => report(data.result),
      onError: (error) => {
        const failure = error as CommandFailure;
        if (failure.result) { report(failure.result); return; }
        setStatus(`Reset unavailable: ${failure.reason ?? failure.message}.`); setFailed(true);
      },
    });
  };

  return <ConfirmDialog
    open={open}
    title="Reset total water?"
    message={`This will reset the total from ${Number(snapshot.entities.total_water?.value).toFixed(1)} L to 0 L. This action cannot be undone.`}
    danger
    confirmText="Reset total"
    status={status || (!pending && reason ? `Reset unavailable: ${reason}.` : "")}
    statusDanger={failed || (!pending && Boolean(reason))}
    pending={pending}
    confirmDisabled={!pending && !canReset(snapshot)}
    onConfirm={confirm}
    onCancel={() => { if (!pending) close(); }}
  />;
}
