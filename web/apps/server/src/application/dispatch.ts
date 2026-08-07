import type { CommandName } from "@hort/contracts";
import { CommandError, handlers, type Context } from "./handlers";

/** Thin dispatch: map a command name + body to its handler. No bus, no registry. */
export function dispatchCommand(ctx: Context, name: string, body: unknown): unknown {
  const handler = (handlers as Record<string, (ctx: Context, body: unknown) => unknown>)[name];
  if (!handler) throw new CommandError(404, `unknown command: ${name}`);
  return handler(ctx, body);
}

export const isCommandName = (name: string): name is CommandName => name in handlers;

/** Queries. */
export const getSnapshot = (ctx: Context) => ctx.controller.getSnapshot();
export const getWateringEvents = (ctx: Context) => ctx.wateringEvents?.recent(100) ?? [];
