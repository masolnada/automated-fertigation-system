import type { WateringEvent } from "@hort/contracts";

// Dev-only mock backend. Serves /api/* with in-memory data so the dashboard
// can run on localhost without the real
// Express server / MQTT broker. Commands mutate the snapshot and are pushed to
// every open SSE client, so Start/Stop, valves and the pre-wet controls all
// react live. Not bundled into production; only dev.ts imports it.
const num = (value: number | string) => ({ value, known: true });

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const madridParts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
const deterministic = (year: number, month: number, day: number) => {
  let value = Math.imul(year, 73856093) ^ Math.imul(month, 19349663) ^ Math.imul(day, 83492791);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
};

// PROTOTYPE: zone/source names live here so the schematic variants have real
// data to render. Real implementation puts these on the server (web ADR-0010).
export const zoneNames: Record<number, string> = { 1: "Olive terrace", 2: "Almond row", 3: "Vegetable beds", 4: "Young trees" };

// A mid-year rename, so the dev dashboard exercises the temporal names of web
// ADR-0010: zone 3 was "Tomato patch" until 1 May of the current year. Events
// before then keep that label, while the zone itself stays one scope.
const renameAt = Date.UTC(new Date().getUTCFullYear(), 4, 1);
const nameAt = (zone: number, endedAt: Date): string =>
  (zone === 3 && endedAt.getTime() < renameAt ? "Tomato patch" : zoneNames[zone]!);

const snapshot = {
  deviceOnline: true,
  brokerConnected: true,
  resetPending: false,
  valves: { clean_water_valve: false, fertigation_valve: false, microbiology_valve: false },
  zoneNames,
  selectedZone: 1,
  entities: {
    battery_voltage: num(13.24), battery_current: num(1.42), battery_state_of_charge: num(87.5), battery_consumed_ah: num(4.2), battery_time_remaining: num(320), battery_charged: num("OFF"),
    flow_rate: num(0), total_water: num(128.6),
    cycle_mode: num("Time"), cycle_minutes: num(30), cycle_liters: num(45), "pre-wet_percent": num(20), flush_minutes: num(3), min_flow: num(0.5),
    irrigation_running: num("OFF"), pump: num("OFF"),
    zone_1: num("ON"), zone_2: num("OFF"), zone_3: num("OFF"), zone_4: num("OFF"),
  } as Record<string, { value: number | string; known: boolean }>,
  log: [
    { message: "Snapshot restored from broker", severity: "normal", time: iso(42) },
    { message: "Valve idle — awaiting sequence", severity: "normal", time: iso(18) },
    { message: "Flow below minimum during last flush", severity: "danger", time: iso(6) },
  ],
};

const season: Record<number, { interval: number; min: number; max: number }> = {
  1: { interval: 16, min: 20, max: 40 }, 2: { interval: 14, min: 25, max: 50 }, 3: { interval: 10, min: 35, max: 70 },
  4: { interval: 7, min: 50, max: 95 }, 5: { interval: 5, min: 70, max: 130 }, 6: { interval: 4, min: 100, max: 180 },
  7: { interval: 3, min: 140, max: 260 }, 8: { interval: 3, min: 130, max: 240 }, 9: { interval: 5, min: 80, max: 150 },
  10: { interval: 8, min: 45, max: 90 }, 11: { interval: 12, min: 30, max: 60 }, 12: { interval: 16, min: 20, max: 45 },
};

function buildWateringEvents(): WateringEvent[] {
  const today = madridParts(new Date());
  const currentYear = Number(today.year);
  const currentMonth = Number(today.month);
  const currentDay = Number(today.day);
  const chronological: WateringEvent[] = [];
  let seq = 1_000;

  for (let year = currentYear - 1; year <= currentYear; year++) {
    const lastMonth = year === currentYear ? currentMonth : 12;
    for (let month = 1; month <= lastMonth; month++) {
      const monthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const lastDay = year === currentYear && month === currentMonth ? currentDay : monthDays;
      const profile = season[month]!;
      for (let day = 1; day <= lastDay; day++) {
        const hash = deterministic(year, month, day);
        const ordinal = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000);
        const springRain = month === 4 && day >= (year % 2 ? 7 : 13) && day <= (year % 2 ? 15 : 21);
        const autumnRain = month === 10 && day >= (year % 2 ? 17 : 22) && day <= (year % 2 ? 28 : 31);
        const heatwave = (month === 7 && day >= 12 && day <= 24) || (month === 8 && year % 2 === 0 && day >= 3 && day <= 10);
        const scheduled = heatwave ? (day + year) % 2 === 0 : (ordinal + year * 3) % profile.interval === 0;
        if (!scheduled || springRain || autumnRain) continue;

        const variation = (hash % 1_001) / 1_000;
        let litres = profile.min + (profile.max - profile.min) * variation;
        if (heatwave) litres *= 1.35;
        let outcome: WateringEvent["outcome"] = "completed";
        if (hash % 97 === 0) { outcome = "dry_run"; litres = 0; }
        else if (hash % 53 === 0) { outcome = "recovery"; litres *= 0.7; }
        else if (hash % 41 === 0) { outcome = "aborted"; litres *= 0.4; }
        litres = Math.round(litres * 10) / 10;

        const trigger: WateringEvent["trigger"] = hash % 11 === 0 ? "manual" : "sequence";
        const zone = 1 + (hash % 4);
        const endedAt = new Date(Date.UTC(year, month - 1, day, 6, 30 + hash % 45));
        const durationMinutes = outcome === "dry_run" ? 4 : Math.max(8, Math.round(litres / 6.5));
        chronological.push({
          id: seq, deviceId: "kc868-a8", seq, startedAt: new Date(endedAt.getTime() - durationMinutes * 60_000).toISOString(), endedAt: endedAt.toISOString(),
          litresDelivered: litres, outcome, trigger, zone, zoneName: nameAt(zone, endedAt),
        });
        seq++;

        const secondZone = 1 + ((hash + 2) % 4);
        const secondPass = heatwave && outcome === "completed" && hash % 5 === 0;
        if (secondPass) {
          const secondLitres = Math.round(litres * (0.65 + (hash % 20) / 100) * 10) / 10;
          const secondEnd = new Date(Date.UTC(year, month - 1, day, 17, 15 + hash % 30));
          chronological.push({
            id: seq, deviceId: "kc868-a8", seq, startedAt: new Date(secondEnd.getTime() - Math.max(8, Math.round(secondLitres / 6.5)) * 60_000).toISOString(), endedAt: secondEnd.toISOString(),
            litresDelivered: secondLitres, outcome: "completed", trigger: "sequence", zone: secondZone, zoneName: nameAt(secondZone, secondEnd),
          });
          seq++;
        }
      }
    }
  }

  return chronological.reverse();
}

const events = buildWateringEvents();

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
      snapshot.valves = { clean_water_valve: valve === "clean_water_valve", fertigation_valve: valve === "fertigation_valve", microbiology_valve: valve === "microbiology_valve" };
      break;
    }
    case "select-zone": {
      const zone = Number(body.zone);
      snapshot.selectedZone = zone;
      for (let n = 1; n <= 4; n++) e[`zone_${n}`] = num(n === zone ? "ON" : "OFF");
      break;
    }
    case "set-zone-name": {
      const zone = Number(body.zone);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (zone >= 1 && zone <= 4 && name) snapshot.zoneNames[zone] = name;
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
  if (path === "/api/watering-history") {
    const since = new Date(url.searchParams.get("since") ?? "");
    const rawUntil = url.searchParams.get("until");
    const until = rawUntil ? new Date(rawUntil) : new Date();
    if (!Number.isFinite(since.getTime())) return Response.json({ error: "since must be an ISO timestamp" }, { status: 400 });
    if (!Number.isFinite(until.getTime()) || until <= since) return Response.json({ error: "until must be an ISO timestamp after since" }, { status: 400 });
    const chartEvents = events.filter((event) => { const ended = event.endedAt ? new Date(event.endedAt).getTime() : NaN; return ended >= since.getTime() && ended < until.getTime(); }).sort((a, b) => new Date(a.endedAt!).getTime() - new Date(b.endedAt!).getTime());
    const controllerOrdered = [...events].sort((a, b) => b.seq - a.seq);
    const lastWatering = controllerOrdered.find((event) => event.litresDelivered > 0) ?? null;
    const earliestEventAt = [...events].map((event) => event.endedAt).filter((value): value is string => Boolean(value)).sort()[0] ?? null;
    return Response.json({ chartEvents, lastWatering, earliestEventAt });
  }
  if (path === "/api/snapshot") return Response.json(snapshot);
  if (path === "/api/health") return Response.json({ ok: true });
  if (req.method === "POST" && path.startsWith("/api/commands/")) {
    const body = await req.json().catch(() => ({}));
    const { status, json } = applyCommand(path.slice("/api/commands/".length), body as Record<string, unknown>);
    return Response.json(json, { status });
  }
  return new Response("Not found", { status: 404 });
}
