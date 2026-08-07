import express, { type Express } from "express";
import { dispatchCommand, getSnapshot, getWateringEvents } from "../../application/dispatch";
import { CommandError, type Context, type ResetOutcome } from "../../application/handlers";

const resetStatus: Record<string, number> = { success: 200, already_zero: 200, rejected_pump_running: 409, rejected_flow_active: 409, rejected_flow_unknown: 409, error_persistence: 500, timeout: 504 };

export function createApp(ctx: Context): Express {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => { res.json({ ok: true }); });
  app.get("/api/snapshot", (_req, res) => { res.json(getSnapshot(ctx)); });
  app.get("/api/watering-events", (_req, res) => { res.json(getWateringEvents(ctx)); });

  app.post("/api/commands/:name", async (req, res) => {
    try {
      const outcome = await dispatchCommand(ctx, req.params.name, req.body);
      if (req.params.name === "reset-total-water") {
        const { result } = outcome as ResetOutcome;
        res.status(resetStatus[result] ?? 500).json({ result });
        return;
      }
      res.status(202).json({ ok: true });
    } catch (error) {
      if (error instanceof CommandError) { res.status(error.status).json({ error: error.message }); return; }
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/stream", (req, res) => {
    res.set({ "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.flushHeaders();
    const send = () => res.write(`data: ${JSON.stringify(getSnapshot(ctx))}\n\n`);
    send();
    const unsubscribe = ctx.controller.subscribe(send);
    req.on("close", () => { unsubscribe(); res.end(); });
  });

  return app;
}
