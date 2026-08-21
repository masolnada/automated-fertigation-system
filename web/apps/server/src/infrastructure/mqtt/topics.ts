import type { StateKind } from "@hort/contracts";

export type ParsedTopic =
  | { type: "state"; kind: StateKind; objectId: string }
  | { type: "status" | "dryRun" | "recoveryFlush" | "resetResult" | "wateringLog" | "debug" }
  | { type: "unknown" };

export function parseStateTopic(prefix: string, topic: string): ParsedTopic {
  if (!topic.startsWith(`${prefix}/`)) return { type: "unknown" };
  const relative = topic.slice(prefix.length + 1);
  if (relative === "status") return { type: "status" };
  if (relative === "flow/dry_run") return { type: "dryRun" };
  if (relative === "irrigation/recovery_flush") return { type: "recoveryFlush" };
  if (relative === "flow/reset_total/result") return { type: "resetResult" };
  if (relative === "watering/log") return { type: "wateringLog" };
  if (relative === "debug") return { type: "debug" };
  const match = /^(sensor|binary_sensor|switch|number|select)\/([^/]+)\/state$/.exec(relative);
  return match ? { type: "state", kind: match[1] as StateKind, objectId: match[2]! } : { type: "unknown" };
}

