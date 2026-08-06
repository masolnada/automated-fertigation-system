import { useMutation } from "@tanstack/react-query";
import type { CommandBodies, CommandName } from "@hort/contracts";

export class CommandFailure extends Error {
  constructor(readonly status: number, readonly result?: string, readonly reason?: string) { super(reason ?? result ?? String(status)); }
}

export async function postCommand<K extends CommandName>(name: K, body: CommandBodies[K] = {} as CommandBodies[K]): Promise<{ result?: string }> {
  const response = await fetch(`/api/commands/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new CommandFailure(response.status, data.result, data.error);
  return data;
}

const command = <K extends CommandName>(name: K) => () => useMutation({ mutationFn: (body: CommandBodies[K]) => postCommand(name, body) });

export const useStartIrrigation = command("start-irrigation");
export const useStopIrrigation = command("stop-irrigation");
export const useTogglePump = command("toggle-pump");
export const useSelectValve = command("select-valve");
export const useSetCycleMode = command("set-cycle-mode");
export const useSetPreWetPercent = command("set-pre-wet-percent");
export const useSetCycleTarget = command("set-cycle-target");
export const useSetFlushDuration = command("set-flush-duration");
export const useSetMinFlow = command("set-min-flow");
export const useResetTotalWater = command("reset-total-water");
