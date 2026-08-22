import type { Context } from "../../../application/command";

export type ZoneContext = Pick<Context, "device" | "controller" | "zones" | "schedules" | "clock" | "ids">;
