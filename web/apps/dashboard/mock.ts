// Dev-only mock backend. Serves /api/* with in-memory data so the dashboard
// (and the pre-wet variant prototype) can run on localhost without the real
// Express server / MQTT broker. Commands mutate the snapshot and are pushed to
// every open SSE client, so Start/Stop, valves and the pre-wet controls all
// react live. Not bundled into production; only dev.ts imports it.
const num = (value: number | string) => ({ value, known: true });

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

const snapshot = {
  deviceOnline: true,
  brokerConnected: true,
  resetPending: false,
  valves: { clean_water_valve: false, fertigation_valve: false },
  entities: {
    battery_voltage: num(13.24), battery_current: num(1.42), battery_state_of_charge: num(87.5), battery_consumed_ah: num(4.2), battery_time_remaining: num(320), battery_charged: num("OFF"),
    flow_rate: num(0), total_water: num(128.6),
    cycle_mode: num("Time"), cycle_minutes: num(30), cycle_liters: num(45), "pre-wet_percent": num(20), flush_minutes: num(3), min_flow: num(0.5),
    irrigation_running: num("OFF"), pump: num("OFF"),
  } as Record<string, { value: number | string; known: boolean }>,
  log: [
    { message: "Snapshot restored from broker", severity: "normal", time: iso(42) },
    { message: "Valve idle — awaiting sequence", severity: "normal", time: iso(18) },
    { message: "Flow below minimum during last flush", severity: "danger", time: iso(6) },
  ],
};

const events = [
  { id: 4, deviceId: "kc868-a8", seq: 104, startedAt: iso(35), endedAt: iso(28), litresDelivered: 42.6, outcome: "completed", trigger: "sequence", channel: "row-a" },
  { id: 3, deviceId: "kc868-a8", seq: 103, startedAt: iso(180), endedAt: iso(176), litresDelivered: 12.1, outcome: "aborted", trigger: "manual", channel: "row-b" },
  { id: 2, deviceId: "kc868-a8", seq: 102, startedAt: iso(1440), endedAt: iso(1432), litresDelivered: 45.0, outcome: "completed", trigger: "sequence", channel: "row-a" },
  { id: 1, deviceId: "kc868-a8", seq: 101, startedAt: iso(2880), endedAt: iso(2874), litresDelivered: 0.0, outcome: "dry_run", trigger: "manual", channel: null },
];

const encoder = new TextEncoder();
const clients = new Set<ReadableStreamDefaultController>();
const frame = () => encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`);
const broadcast = () => { for (const client of clients) { try { client.enqueue(frame()); } catch { clients.delete(client); } } };

const running = () => snapshot.entities.irrigation_running!.value === "ON";
// Light tick so a running cycle visibly moves: flow rate jitters, totals climb.
setInterval(() => {
  if (!running()) return;
  snapshot.entities.flow_rate = num(Number((2.1 + Math.random() * 0.6).toFixed(1)));
  snapshot.entities.total_water = num(Number((Number(snapshot.entities.total_water!.value) + 0.4).toFixed(1)));
  broadcast();
}, 2000);

function applyCommand(name: string, body: Record<string, unknown>): { status: number; json: unknown } {
  const e = snapshot.entities;
  switch (name) {
    case "start-irrigation": e.irrigation_running = num("ON"); e.flow_rate = num(2.3); break;
    case "stop-irrigation": e.irrigation_running = num("OFF"); e.flow_rate = num(0); break;
    case "toggle-pump": e.pump = num(e.pump!.value === "ON" ? "OFF" : "ON"); break;
    case "select-valve": {
      const valve = body.valve;
      snapshot.valves = { clean_water_valve: valve === "clean_water_valve", fertigation_valve: valve === "fertigation_valve" };
      break;
    }
    case "set-cycle-mode": e.cycle_mode = num(String(body.mode)); break;
    case "set-pre-wet-percent": e["pre-wet_percent"] = num(Number(body.value)); break;
    case "set-cycle-target": e[e.cycle_mode!.value === "Volume" ? "cycle_liters" : "cycle_minutes"] = num(Number(body.value)); break;
    case "set-flush-duration": e.flush_minutes = num(Number(body.value)); break;
    case "set-min-flow": e.min_flow = num(Number(body.value)); break;
    case "reset-total-water": e.total_water = num(0); broadcast(); return { status: 200, json: { result: "success" } };
  }
  broadcast();
  return { status: 202, json: { ok: true } };
}

/** Returns a mock Response for a known /api route, or null to let the caller 404. */
export async function mockApi(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (!path.startsWith("/api/")) return null;

  if (path === "/api/stream") {
    let self: ReadableStreamDefaultController;
    const stream = new ReadableStream({
      start(controller) { self = controller; clients.add(controller); controller.enqueue(frame()); },
      cancel() { clients.delete(self); },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" } });
  }
  if (path === "/api/watering-events") return Response.json(events);
  if (path === "/api/snapshot") return Response.json(snapshot);
  if (path === "/api/health") return Response.json({ ok: true });
  if (req.method === "POST" && path.startsWith("/api/commands/")) {
    const body = await req.json().catch(() => ({}));
    const { status, json } = applyCommand(path.slice("/api/commands/".length), body as Record<string, unknown>);
    return Response.json(json, { status });
  }
  return new Response("Not found", { status: 404 });
}
