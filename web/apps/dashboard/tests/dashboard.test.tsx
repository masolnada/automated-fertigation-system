import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Snapshot as WireSnapshot } from "@hort/contracts";
import { App } from "../src/App";
import { SnapshotStore } from "../src/store";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const entity = (value: number | string) => ({ value, known: true });
const wire = (partial: Partial<WireSnapshot> = {}): WireSnapshot => ({ brokerConnected: true, deviceOnline: true, entities: {}, valves: { clean_water_valve: false, fertigation_valve: false, microbiology_valve: false }, selectedOutput: 0, zones: [], assignments: {}, resetPending: false, log: [], ...partial });
const zone = (id: string, name: string, archived = false) => ({ id, name, archived });
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
/** The diagram has no info panel, so flow detail lives behind its node's modal. */
function selectFlow() { fireEvent.click(screen.getAllByRole("button", { name: /Flow/ })[0]!); }
/** Zone names appear on the schematic and in the watering history, so scope by card. */
function schematic() { return within(document.querySelector(".card-schematic") as HTMLElement); }
function zonesCard() { return within(document.querySelector(".card-zones") as HTMLElement); }

describe("snapshot rendering", () => {
  test("formats values and shows – after invalidation", () => {
    const store = seeded({ entities: { ...eligibleEntities(), battery_voltage: entity(12.345) } });
    renderApp(store);
    selectFlow();
    expect(screen.getByText("12.35")).toBeTruthy();
    expect(screen.getByText("12.3")).toBeTruthy();
    act(() => store.replace(wire({ deviceOnline: false, brokerConnected: false, entities: {} })));
    expect(screen.getAllByText("–").length).toBeGreaterThan(0);
  });
});

describe("watering history", () => {
  test("shows Last watering, the yearly cell, and the selected day's event list", async () => {
    const endedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    const event = { id: 1, deviceId: "kc868-a8", seq: 4, startedAt: new Date(new Date(endedAt).getTime() - 10 * 60_000).toISOString(), endedAt, litresDelivered: 12.4, outcome: "completed", trigger: "sequence", outputChannel: null, zoneId: null, zoneName: null };
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
  // A zone is scoped by id, so it follows its own history across a re-plumb onto
  // another output channel (web ADR-0014). Archived zones stay on the list —
  // preserving their history is why archiving exists rather than deletion.
  test("a zone scope follows it across output channels, and archived zones stay offered", async () => {
    const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
    const event = (id: number, litres: number, outputChannel: number, minutesAgo: number) =>
      ({ id, deviceId: "kc868-a8", seq: id, startedAt: at(minutesAgo + 10), endedAt: at(minutesAgo), litresDelivered: litres, outcome: "completed", trigger: "sequence", outputChannel, zoneId: "z-veg", zoneName: "Vegetable beds" });
    // Same zone, two different channels: re-plumbed between the two events.
    const chartEvents = [event(1, 10, 3, 90), event(2, 5, 2, 30)];
    responders["watering-history"] = async () => json({ chartEvents, lastWatering: chartEvents[1], earliestEventAt: chartEvents[0]!.endedAt }, 200);
    renderApp(seeded({ zones: [zone("z-veg", "Vegetable beds"), zone("z-tomato", "Tomato patch", true)] }));

    const select = await screen.findByRole("button", { name: "Scope history to a zone" });
    fireEvent.click(select);
    const listbox = within(screen.getByRole("listbox", { name: "Scope history to a zone" }));
    expect(listbox.getAllByRole("option").map((option) => option.textContent)).toEqual(["All zones", "Vegetable beds", "Tomato patch (archived)", "No zone"]);

    fireEvent.click(listbox.getByRole("option", { name: "Vegetable beds" }));
    // Both events survive the scope despite running on different channels.
    await waitFor(() => expect(screen.getByRole("gridcell", { name: /15.0 litres, 2 watering events/ })).toBeTruthy());
  });
});

describe("reset", () => {
  test("guard reason disables the reset control", () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), flow_rate: entity(1) } }));
    selectFlow();
    expect(screen.getByRole("button", { name: "Reset total water" }).hasAttribute("disabled")).toBe(true);
  });
  test("pending cannot close; success posts and closes", async () => {
    let release!: (r: Response) => void;
    responders["reset-total-water"] = () => new Promise((resolve) => { release = resolve; });
    renderApp(seeded());
    selectFlow();
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
    selectFlow();
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
  test("selecting an output channel opens it; selecting the open one shuts it", async () => {
    renderApp(seeded());
    fireEvent.click(schematic().getByRole("button", { name: /Output 2/ }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "select-output", body: { channel: 2 } }));
    cleanup();
    renderApp(seeded({ selectedOutput: 2 }));
    fireEvent.click(schematic().getByRole("button", { name: /Output 2/ }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "select-output", body: { channel: 0 } }));
  });
  // A channel is labelled with the zone assigned to it (web ADR-0014); with none
  // assigned it stays operable under its own name.
  test("an assigned output channel is labelled with its zone", () => {
    renderApp(seeded({ zones: [zone("z-olive", "Olive terrace")], assignments: { 1: "z-olive" } }));
    expect(schematic().getByRole("button", { name: /Olive terrace/ })).toBeTruthy();
    expect(schematic().getByRole("button", { name: /Output 2/ })).toBeTruthy();
  });
  test("renaming a zone is a plain edit", async () => {
    renderApp(seeded({ zones: [zone("z-olive", "Olive terrace")], assignments: { 1: "z-olive" } }));
    fireEvent.click(zonesCard().getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByDisplayValue("Olive terrace"), { target: { value: "Almond row" } });
    expect(calls.some((call) => call.name === "rename-zone")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Rename zone" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "rename-zone", body: { id: "z-olive", name: "Almond row" } }));
  });
  // Archiving also clears the channel assignment, which the click does not show —
  // hence the Confirmation (web ADR-0014).
  test("archiving a zone is confirmed and says its channel is freed", async () => {
    renderApp(seeded({ zones: [zone("z-olive", "Olive terrace")], assignments: { 1: "z-olive" } }));
    fireEvent.click(zonesCard().getByRole("button", { name: "Archive" }));
    expect(screen.getByText(/The channel feeding it will be left unassigned/)).toBeTruthy();
    expect(calls.some((call) => call.name === "archive-zone")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Archive zone" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "archive-zone", body: { id: "z-olive" } }));
  });
  test("the assignation editor saves the whole table at once", async () => {
    renderApp(seeded({ zones: [zone("z-olive", "Olive terrace"), zone("z-almond", "Almond row")], assignments: { 1: "z-olive" } }));
    fireEvent.click(schematic().getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Zone for Output 2" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Zone for Output 2" })).getByRole("option", { name: "Almond row" }));
    fireEvent.click(screen.getByRole("button", { name: "Save assignments" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "set-assignments", body: { assignments: { 1: "z-olive", 2: "z-almond", 3: null, 4: null } } }));
  });
  // A zone already on a channel is hidden from the others, so the table cannot be
  // put into a state the one-to-one rule forbids.
  test("an assigned zone is not offered to another channel", () => {
    renderApp(seeded({ zones: [zone("z-olive", "Olive terrace"), zone("z-almond", "Almond row")], assignments: { 1: "z-olive" } }));
    fireEvent.click(schematic().getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Zone for Output 2" }));
    const listbox = within(screen.getByRole("listbox", { name: "Zone for Output 2" }));
    expect(listbox.queryByRole("option", { name: "Olive terrace" })).toBeNull();
    expect(listbox.getByRole("option", { name: "Almond row" })).toBeTruthy();
  });
  test("editing assignments is refused while the pump runs", () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), pump: entity("ON") } }));
    expect(schematic().getByRole("button", { name: "Edit" }).hasAttribute("disabled")).toBe(true);
  });
  test("warns when the pump has no open path", () => {
    renderApp(seeded());
    expect(screen.getAllByText("no path").length).toBeGreaterThan(0);
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
});

// The channel is an input to the run, not the device's Selected Output: picking
// one opens no valve, and the start carries it.
describe("the channel an irrigation waters", () => {
  const withZones = (partial: Partial<WireSnapshot> = {}) => seeded({ zones: [zone("z-olive", "Olive terrace"), zone("z-almond", "Almond row")], assignments: { 1: "z-olive", 2: "z-almond" }, ...partial });
  const irrigation = () => within(document.querySelector(".card-irrigation") as HTMLElement);

  test("offers every zone, marks the open one, and names an unassigned channel", () => {
    renderApp(withZones({ selectedOutput: 1 }));
    expect(irrigation().getByRole("button", { name: /^Olive terrace open now$/ })).toBeTruthy();
    expect(irrigation().getByRole("button", { name: "Almond row" })).toBeTruthy();
    // A channel with no zone still waters, and is the one place the dashboard
    // says "Output N" (web ADR-0014).
    expect(irrigation().getByRole("button", { name: "Output 3" })).toBeTruthy();
  });
  test("picking a channel opens no valve, and starting carries it", async () => {
    renderApp(withZones({ selectedOutput: 1 }));
    fireEvent.click(irrigation().getByRole("button", { name: /Almond row/ }));
    expect(calls).toHaveLength(0);
    fireEvent.click(irrigation().getByRole("button", { name: "Start irrigation" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start irrigation" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "start-irrigation", body: { channel: 2 } }));
  });
  test("the confirmation names the zone about to be watered", () => {
    renderApp(withZones({ selectedOutput: 2 }));
    fireEvent.click(irrigation().getByRole("button", { name: "Start irrigation" }));
    expect(screen.getByText(/Almond row gets the full sequence/)).toBeTruthy();
  });
  test("a start with no channel is disabled rather than silently doing nothing", () => {
    renderApp(withZones({ selectedOutput: 0 }));
    expect(irrigation().getByRole("button", { name: "Start irrigation" }).hasAttribute("disabled")).toBe(true);
  });
  test("a later snapshot does not move the operator's pick", () => {
    const store = withZones({ selectedOutput: 1 });
    renderApp(store);
    fireEvent.click(irrigation().getByRole("button", { name: /Almond row/ }));
    act(() => store.replace(wire({ entities: eligibleEntities(), zones: [zone("z-olive", "Olive terrace"), zone("z-almond", "Almond row")], assignments: { 1: "z-olive", 2: "z-almond" }, selectedOutput: 3 })));
    expect(irrigation().getByRole("button", { name: /Almond row/ }).getAttribute("aria-pressed")).toBe("true");
  });
  test("the picker is read-only while a sequence runs", () => {
    renderApp(withZones({ selectedOutput: 1, entities: { ...eligibleEntities(), irrigation_running: entity("ON") } }));
    expect(irrigation().getByRole("button", { name: /Almond row/ }).hasAttribute("disabled")).toBe(true);
  });
});
