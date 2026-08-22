import type { Context } from "../../../application/command";

export type IrrigationContext = Pick<Context, "device" | "controller" | "resetTimeoutMs">;
