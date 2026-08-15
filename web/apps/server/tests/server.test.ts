import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import Aedes from "aedes";
import { createServer, type Server as NetServer } from "node:net";
import type { Server as HttpServer } from "node:http";
import mqtt, { type MqttClient } from "mqtt";
import { Controller } from "../src/domain/controller";
import { MqttDevice } from "../src/infrastructure/mqtt/adapter";
import { createApp } from "../src/infrastructure/http/app";
import type { Context } from "../src/application/handlers";

const prefix = "test-hort";
let broker: Aedes, brokerServer: NetServer, brokerUrl = "";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  broker = new Aedes();
  brokerServer = createServer((socket) => broker.handle(socket, {} as never));
  await new Promise<void>((resolve) => brokerServer.listen(0, "127.0.0.1", resolve));
  const address = brokerServer.address();
  if (!address || typeof address === "string") throw new Error("no address");
  brokerUrl = `mqtt://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => brokerServer.close(() => resolve())); await new Promise<void>((resolve) => broker.close(() => resolve())); });

type Harness = { ctx: Context; device: MqttDevice; controller: Controller; url: string; http: HttpServer; extras: MqttClient[] };
const harnesses: Harness[] = [];

async function waitFor(predicate: () => boolean, timeout = 2000) { const start = Date.now(); while (!predicate()) { if (Date.now() - start > timeout) throw new Error("timeout waiting for condition"); await sleep(10); } }

async function start(resetTimeoutMs = 300): Promise<Harness> {
  const controller = new Controller();
  const device = new MqttDevice({ brokerUrl, username: "", password: "", prefix, port: 0, dbPath: ":memory:" }, controller);
  const ctx: Context = { device, controller, resetTimeoutMs };
  const app = createApp(ctx);
  const http = app.listen(0);
  await new Promise<void>((resolve) => http.on("listening", () => resolve()));
  await waitFor(() => controller.getSnapshot().brokerConnected);
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("no http address");
  const harness: Harness = { ctx, device, controller, url: `http://127.0.0.1:${address.port}`, http, extras: [] };
  harnesses.push(harness);
  return harness;
}
afterEach(async () => {
  for (const h of harnesses.splice(0)) {
    await Promise.all(h.extras.map((c) => new Promise<void>((r) => c.end(true, {}, () => r()))));
    h.device.close();
    await new Promise<void>((resolve) => h.http.close(() => resolve()));
  }
});

function fakeDevice(h: Harness, onResetRequest?: (publish: (result: string) => void) => void): MqttClient {
  const client = mqtt.connect(brokerUrl); h.extras.push(client);
  client.on("connect", () => { client.subscribe(`${prefix}/#`); });
  if (onResetRequest) client.on("message", (topic) => { if (topic === `${prefix}/flow/reset_total/request`) onResetRequest((result) => client.publish(`${prefix}/flow/reset_total/result`, result)); });
  return client;
}
async function seedEligible(h: Harness) {
  for (const [topic, payload] of [[`${prefix}/status`, "online"], [`${prefix}/switch/pump/state`, "OFF"], [`${prefix}/sensor/flow_rate/state`, "0"], [`${prefix}/sensor/total_water/state`, "12.3"]] as const) broker.publish({ cmd: "publish", qos: 0, dup: false, retain: true, topic, payload } as never, () => {});
  await waitFor(() => Number(h.controller.getSnapshot().entities.total_water?.value) === 12.3 && h.controller.getSnapshot().deviceOnline);
}
const post = (url: string, name: string, body: unknown = {}) => fetch(`${url}/api/commands/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("synchronous reset round-trip", () => {
  test("guard ineligible returns 409 and does not publish", async () => {
    const h = await start();
    let published = false; fakeDevice(h, () => { published = true; });
    const res = await post(h.url, "reset-total-water");
    expect(res.status).toBe(409);
    await sleep(100); expect(published).toBe(false);
  });
  test("device replies success returns 200", async () => {
    const h = await start(); fakeDevice(h, (publish) => publish("success"));
    await seedEligible(h);
    const res = await post(h.url, "reset-total-water");
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ result: "success" });
  });
  test("device silent resolves as timeout", async () => {
    const h = await start(200); fakeDevice(h);
    await seedEligible(h);
    const res = await post(h.url, "reset-total-water");
    expect(res.status).toBe(504); expect(await res.json()).toEqual({ result: "timeout" });
  });
});

async function readSnapshots(url: string, onSnapshot: (snapshot: any) => void, signal: AbortSignal) {
  const res = await fetch(`${url}/api/stream`, { signal });
  const reader = res.body!.getReader(); const decoder = new TextDecoder(); let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf("\n\n")) !== -1) { const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2); const line = frame.split("\n").find((l) => l.startsWith("data: ")); if (line) onSnapshot(JSON.parse(line.slice(6))); }
    }
  } catch { /* aborted */ }
}

describe("SSE snapshot stream", () => {
  test("coalesces a burst into one snapshot reflecting the change", async () => {
    const h = await start();
    const snapshots: any[] = []; const controllerAbort = new AbortController();
    const reading = readSnapshots(h.url, (s) => snapshots.push(s), controllerAbort.signal);
    await waitFor(() => snapshots.length >= 1); // initial snapshot
    const before = snapshots.length;
    for (const [topic, payload] of [[`${prefix}/sensor/flow_rate/state`, "1.5"], [`${prefix}/sensor/total_water/state`, "9"], [`${prefix}/number/flush_minutes/state`, "4"]] as const) broker.publish({ cmd: "publish", qos: 0, dup: false, retain: true, topic, payload } as never, () => {});
    await waitFor(() => snapshots.some((s) => s.entities.flush_minutes?.value === 4));
    const last = snapshots.at(-1);
    expect(last.entities.flow_rate.value).toBe(1.5); expect(last.entities.total_water.value).toBe(9);
    expect(snapshots.length - before).toBeLessThanOrEqual(2); // burst coalesced (not one push per message)
    controllerAbort.abort(); await reading;
  });
});

describe("watering history read", () => {
  test("requires a valid range start", async () => {
    const h = await start();
    const invalid = await fetch(`${h.url}/api/watering-history?since=not-a-date`);
    expect(invalid.status).toBe(400);
    const since = new Date(Date.now() - 1000);
    const invalidUntil = await fetch(`${h.url}/api/watering-history?since=${encodeURIComponent(since.toISOString())}&until=${encodeURIComponent(new Date(since.getTime() - 1).toISOString())}`);
    expect(invalidUntil.status).toBe(400);
    const valid = await fetch(`${h.url}/api/watering-history?since=${encodeURIComponent(since.toISOString())}&until=${encodeURIComponent(new Date(since.getTime() + 1000).toISOString())}`);
    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual({ chartEvents: [], lastWatering: null, earliestEventAt: null });
  });
});

describe("start-irrigation carries the channel", () => {
  test("a start with no channel is 400 and publishes nothing", async () => {
    const h = await start();
    let published = false; const listener = fakeDevice(h); listener.on("message", (topic) => { if (topic === `${prefix}/irrigation/start`) published = true; });
    for (const body of [{}, { channel: 0 }, { channel: 5 }, { channel: "2" }]) expect((await post(h.url, "start-irrigation", body)).status).toBe(400);
    await sleep(100); expect(published).toBe(false);
  });
  test("a valid channel is published as the start payload", async () => {
    const h = await start();
    let payload = ""; const listener = fakeDevice(h); listener.on("message", (topic, data) => { if (topic === `${prefix}/irrigation/start`) payload = data.toString(); });
    await new Promise<void>((resolve) => listener.subscribe(`${prefix}/irrigation/start`, () => resolve()));
    expect((await post(h.url, "start-irrigation", { channel: 3 })).status).toBe(202);
    await waitFor(() => payload === "3");
  });
});

describe("validated command loop (SetFlushDuration)", () => {
  test("out-of-range body is 400 with no publish", async () => {
    const h = await start();
    let published = false; const listener = fakeDevice(h); listener.on("message", (topic) => { if (topic === `${prefix}/number/flush_minutes/command`) published = true; });
    const res = await post(h.url, "set-flush-duration", { value: 999 });
    expect(res.status).toBe(400); await sleep(100); expect(published).toBe(false);
  });
  test("valid body is 202 and reflected back over SSE", async () => {
    const h = await start(); fakeDevice(h, undefined);
    // Echo the command back as state, like the device would.
    const echo = mqtt.connect(brokerUrl); h.extras.push(echo);
    await new Promise<void>((resolve) => echo.on("connect", () => echo.subscribe(`${prefix}/number/flush_minutes/command`, () => resolve())));
    echo.on("message", (_topic, payload) => echo.publish(`${prefix}/number/flush_minutes/state`, payload.toString(), { retain: true }));
    const snapshots: any[] = []; const abort = new AbortController();
    const reading = readSnapshots(h.url, (s) => snapshots.push(s), abort.signal);
    await waitFor(() => snapshots.length >= 1);
    const res = await post(h.url, "set-flush-duration", { value: 7 });
    expect(res.status).toBe(202);
    await waitFor(() => snapshots.some((s) => s.entities.flush_minutes?.value === 7));
    abort.abort(); await reading;
  });
});
