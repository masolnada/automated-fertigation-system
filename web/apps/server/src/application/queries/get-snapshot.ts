import type { Context } from "../handlers";

export const getSnapshot = (ctx: Pick<Context, "controller">) => ctx.controller.getSnapshot();
