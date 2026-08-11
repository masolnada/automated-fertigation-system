import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Snapshot as WireSnapshot } from "@hort/contracts";
import { App } from "../src/App";
import { SnapshotStore } from "../src/store";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const entity = (value: number | string) => ({ value, known: true });
const wire = (partial: Partial<WireSnapshot> = {}): WireSnapshot => ({ brokerConnected: true, deviceOnline: true, entities: {}, valves: { clean_water_valve: false, fertigation_valve: false, microbiology_valve: false }, selectedZone: 0, zoneNames: {}, resetPending: false, log: [], ...partial });
const eligibleEntities = () => ({ pump: entity("OFF"), flow_rate: entity(0), total_water: entity(12.3) });

type Call = { name: string; body: Record<string, unknown> };
let calls: Call[] = [];
let responders: Record<string, () => Promise<Response>> = {};
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  calls = []; responders = { "watering-history": () => new Promise<Response>(() => {}) };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const name = url.pathname.split("/").pop()!;
    if (init?.method === "POST") calls.push({ name, body: init?.body ? JSON.parse(String(init.body)) : {} });
    return responders[name] ? responders[name]!() : json({ ok: true }, 202);
  }) as typeof fetch;
});
afterEach(async () => { await act(async () => { await sleep(0); }); cleanup(); });

function renderApp(store: SnapshotStore) { const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } }); return render(<QueryClientProvider client={client}><App store={store}/></QueryClientProvider>); }
function seeded(partial: Partial<WireSnapshot> = {}) { const store = new SnapshotStore(); act(() => store.replace(wire({ entities: eligibleEntities(), ...partial }))); return store; }

describe("snapshot rendering", () => {
  test("formats values and shows – after invalidation", () => {
    const store = seeded({ entities: { ...eligibleEntities(), battery_voltage: entity(12.345) } });
    renderApp(store);
    expect(screen.getByText("12.35")).toBeTruthy();
    expect(screen.getByText("12.3")).toBeTruthy();
    act(() => store.replace(wire({ deviceOnline: false, brokerConnected: false, entities: {} })));
    expect(screen.getAllByText("–").length).toBeGreaterThan(0);
  });
});

describe("watering history", () => {
  test("shows Last watering, the yearly cell, and the selected day's event list", async () => {
    const endedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    const event = { id: 1, deviceId: "kc868-a8", seq: 4, startedAt: new Date(new Date(endedAt).getTime() - 10 * 60_000).toISOString(), endedAt, litresDelivered: 12.4, outcome: "completed", trigger: "sequence", channel: null };
    responders["watering-history"] = async () => json({ chartEvents: [event], lastWatering: event, earliestEventAt: endedAt }, 200);
    renderApp(seeded());
    await waitFor(() => expect(screen.getByText("5 min ago")).toBeTruthy());
    expect(screen.getByRole("gridcell", { name: /12.4 litres, 1 watering event, 0 errors/ })).toBeTruthy();
    expect(screen.getByText("12.4 L")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /show events/i })).toBeNull();
  });
  test("shows Watering now whenever the pump is on", async () => {
    responders["watering-history"] = async () => json({ chartEvents: [], lastWatering: null, earliestEventAt: null }, 200);
    renderApp(seeded({ entities: { ...eligibleEntities(), pump: entity("ON") } }));
    await waitFor(() => expect(screen.getByText("Watering now")).toBeTruthy());
  });
  test("distinguishes an unavailable history request from empty history", async () => {
    responders["watering-history"] = async () => json({ error: "offline" }, 503);
    renderApp(seeded());
    await waitFor(() => expect(screen.getByText("Watering history unavailable")).toBeTruthy());
    expect(screen.queryByText("No watering recorded")).toBeNull();
  });
});

describe("reset", () => {
  test("guard reason disables the reset control", () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), flow_rate: entity(1) } }));
    expect(screen.getByRole("button", { name: "Reset total water" }).hasAttribute("disabled")).toBe(true);
  });
  test("pending cannot close; success posts and closes", async () => {
    let release!: (r: Response) => void;
    responders["reset-total-water"] = () => new Promise((resolve) => { release = resolve; });
    renderApp(seeded());
    fireEvent.click(screen.getByRole("button", { name: "Reset total water" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset total" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "reset-total-water", body: {} }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => { release(json({ result: "success" }, 200)); await sleep(0); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  test("timeout surfaces the danger message with cancel enabled", async () => {
    responders["reset-total-water"] = async () => json({ result: "timeout" }, 504);
    renderApp(seeded());
    fireEvent.click(screen.getByRole("button", { name: "Reset total water" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset total" }));
    await waitFor(() => expect(screen.getByText("No response from device. Check its connection and current total before retrying.")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(false);
  });
});

describe("commands", () => {
  test("selecting a source opens it; selecting the open one shuts it", async () => {
    renderApp(seeded());
    fireEvent.click(screen.getByRole("button", { name: /Clean water/ }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "select-valve", body: { valve: "clean_water_valve" } }));
    act(() => { /* device confirms */ });
    const store = seeded({ valves: { clean_water_valve: true, fertigation_valve: false, microbiology_valve: false } });
    cleanup();
    renderApp(store);
    fireEvent.click(screen.getByRole("button", { name: /Clean water/ }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "select-valve", body: { valve: "" } }));
  });
  test("selecting a zone opens it; selecting the open one shuts it", async () => {
    renderApp(seeded());
    fireEvent.click(screen.getByRole("button", { name: /Zone 2/ }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "select-zone", body: { zone: 2 } }));
    cleanup();
    renderApp(seeded({ selectedZone: 2 }));
    fireEvent.click(screen.getByRole("button", { name: /Zone 2/ }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "select-zone", body: { zone: 0 } }));
  });
  test("renaming a zone requires confirmation", async () => {
    renderApp(seeded({ selectedZone: 1, zoneNames: { 1: "Olive terrace" } }));
    fireEvent.click(screen.getByRole("button", { name: /Olive terrace/ }));
    const input = screen.getByLabelText("Name for zone 1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Almond row" } });
    expect(calls.some((c) => c.name === "set-zone-name")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename zone" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "set-zone-name", body: { zone: 1, name: "Almond row" } }));
  });
  test("warns when the pump has no open path", () => {
    renderApp(seeded());
    expect(screen.getByText("Pump cannot run")).toBeTruthy();
  });
  test("cycle mode posts immediately", async () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), cycle_mode: entity("Time") } }));
    fireEvent.change(screen.getByLabelText("Cycle Mode"), { target: { value: "Volume" } });
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "set-cycle-mode", body: { mode: "Volume" } }));
  });
  test("number input debounces into a single command", async () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), flush_minutes: entity(5) } }));
    const input = screen.getByDisplayValue("5");
    fireEvent.change(input, { target: { value: "6" } });
    fireEvent.change(input, { target: { value: "7" } });
    expect(calls).toHaveLength(0);
    await waitFor(() => expect(calls).toEqual([{ name: "set-flush-duration", body: { value: 7 } }]));
  });
  test("pre-wet preset posts immediately", async () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), "pre-wet_percent": entity(20) } }));
    fireEvent.click(screen.getByRole("button", { name: "25%" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "set-pre-wet-percent", body: { value: 25 } }));
  });
  test("only offers Stop while irrigation is running", () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), irrigation_running: entity("ON") } }));
    expect(screen.getByRole("button", { name: "Stop irrigation" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start irrigation" })).toBeNull();
  });
  test("Escape closes the menu before the dialog", async () => {
    renderApp(seeded());
    const trigger = screen.getByRole("button", { name: "Flow actions" });
    trigger.focus(); fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await sleep(0);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
