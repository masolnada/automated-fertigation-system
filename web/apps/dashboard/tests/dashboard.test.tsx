import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Snapshot as WireSnapshot } from "@hort/contracts";
import { App } from "../src/App";
import { SnapshotStore } from "../src/store";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const entity = (value: number | string) => ({ value, known: true });
const wire = (partial: Partial<WireSnapshot> = {}): WireSnapshot => ({ brokerConnected: true, deviceOnline: true, entities: {}, valves: { clean_water_valve: false, fertigation_valve: false }, resetPending: false, log: [], ...partial });
const eligibleEntities = () => ({ pump: entity("OFF"), flow_rate: entity(0), total_water: entity(12.3) });

type Call = { name: string; body: Record<string, unknown> };
let calls: Call[] = [];
let responders: Record<string, () => Promise<Response>> = {};
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  calls = []; responders = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const name = String(input).split("/").pop()!;
    calls.push({ name, body: init?.body ? JSON.parse(String(init.body)) : {} });
    return responders[name] ? responders[name]!() : json({ ok: true }, 202);
  }) as typeof fetch;
});
afterEach(() => cleanup());

function renderApp(store: SnapshotStore) { const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } }); return render(<QueryClientProvider client={client}><App store={store}/></QueryClientProvider>); }
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

describe("reset", () => {
  test("guard reason disables the menu item", () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), flow_rate: entity(1) } }));
    fireEvent.click(screen.getByRole("button", { name: "Flow actions" }));
    expect(screen.getByRole("menuitem", { name: "Reset total water" }).hasAttribute("disabled")).toBe(true);
  });
  test("pending cannot close; success posts and closes", async () => {
    let release!: (r: Response) => void;
    responders["reset-total-water"] = () => new Promise((resolve) => { release = resolve; });
    renderApp(seeded());
    fireEvent.click(screen.getByRole("button", { name: "Flow actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reset total water" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Flow actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reset total water" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset total" }));
    await waitFor(() => expect(screen.getByText("No response from device. Check its connection and current total before retrying.")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(false);
  });
});

describe("commands", () => {
  test("valve selection is exclusive", async () => {
    const store = seeded();
    renderApp(store);
    fireEvent.click(screen.getByRole("button", { name: "Clean" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "select-valve", body: { valve: "clean_water_valve" } }));
    expect(screen.getByText("Switching… both valves close for a moment")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Closed" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "select-valve", body: { valve: "" } }));
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
  test("pre-wet slider posts on release", async () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), "pre-wet_percent": entity(20) } }));
    const slider = screen.getByRole("slider", { name: "Pre-wet Percent" });
    fireEvent.change(slider, { target: { value: "35" } });
    expect(calls).toHaveLength(0);
    fireEvent.pointerUp(slider);
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "set-pre-wet-percent", body: { value: 35 } }));
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
