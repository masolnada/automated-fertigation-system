import type { Context } from "../../../application/command";

export type SchedulingContext = Pick<Context, "device" | "controller" | "schedules" | "clock" | "ids">;
