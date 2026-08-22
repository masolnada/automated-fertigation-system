import type { Context } from "../../../../application/handlers";

export type WateringQueryContext = Pick<Context, "wateringEvents" | "zones">;
