import express, { type Express } from "express";
import { dispatchCommand, getSnapshot, getWateringEvents, getWateringHistory } from "../../application/dispatch";
import { CommandError, type Context, type ResetOutcome } from "../../application/handlers";

const resetStatus: Record<string, number> = { success: 200, already_zero: 200, rejected_pump_running: 409, rejected_flow_active: 409, rejected_flow_unknown: 409, error_persistence: 500, timeout: 504, unexpected_response: 500 };

export function createApp(ctx: Context): Express {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => { res.json({ ok: true }); });
  app.get("/api/snapshot", (_req, res) => { res.json(getSnapshot(ctx)); });
  app.get("/api/watering-events", (_req, res) => { res.json(getWateringEvents(ctx)); });
  app.get("/api/watering-history", (req, res) => {
    const rawSince = typeof req.query.since === "string" ? req.query.since : "";
    const rawUntil = typeof req.query.until === "string" ? req.query.until : "";
    const since = new Date(rawSince);
    const until = rawUntil ? new Date(rawUntil) : new Date();
    if (!rawSince || !Number.isFinite(since.getTime())) { res.status(400).json({ error: "since must be an ISO timestamp" }); return; }
    if (!Number.isFinite(until.getTime()) || until <= since) { res.status(400).json({ error: "until must be an ISO timestamp after since" }); return; }
    res.json(getWateringHistory(ctx, since, until));
  });

  app.post("/api/commands/:name", async (req, res) => {
    try {
      const outcome = await dispatchCommand(ctx, req.params.name, req.body);
      if (req.params.name === "reset-total-water") {
        const { result } = outcome as ResetOutcome;
        res.status(resetStatus[result] ?? 500).json({ result });
        return;
      }
      // Most commands return nothing; `create-zone` returns the zone it made, so
      // the caller learns the id without racing the next snapshot.
      res.status(202).json(outcome ?? { ok: true });
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
