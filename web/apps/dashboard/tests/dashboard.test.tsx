import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type Snapshot as WireSnapshot } from "@hort/contracts";
import { App } from "../src/App";
import { SnapshotStore } from "../src/store";
import { resetZoneColours, setZoneColour } from "../src/zoneColours";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const entity = (value: number | string) => ({ value, known: true });
const wire = (partial: Partial<WireSnapshot> = {}): WireSnapshot => ({ brokerConnected: true, deviceOnline: true, entities: {}, valves: { clean_water_valve: false, fertigation_valve: false, microbiology_valve: false }, selectedOutput: 0, zones: [], assignments: {}, resetPending: false, schedules: [], log: [], ...partial });
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
afterEach(async () => { await act(async () => { await sleep(0); }); cleanup(); resetZoneColours(); });

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
  test("creating a zone needs only a name", async () => {
    renderApp(seeded());
    fireEvent.click(zonesCard().getByRole("button", { name: "New zone" }));
    expect(screen.getByRole("button", { name: "Create zone" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Zone name"), { target: { value: "Herb strip" } });
    expect(screen.getByRole("button", { name: "Create zone" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Create zone" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "create-zone", body: { name: "Herb strip" } }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  // Color is a browser-local aid (web ADR-0019): picked per zone, kept in
  // localStorage, and absent (gray) until chosen.
  test("a zone's color is a local pick shown on its marker and the schematic", () => {
    const id = "z-local-pick";
    renderApp(seeded({ zones: [zone(id, "Olive terrace")], assignments: { 1: id } }));
    const colorButton = zonesCard().getByRole("button", { name: "Color for Olive terrace" });
    const zoneRow = colorButton.closest("li")!;
    expect(zoneRow.querySelector("[data-zone-colour]")).toBeNull();
    fireEvent.click(colorButton);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Petrol" }));
    expect(zoneRow.querySelector('[data-zone-colour="petrol"]')).toBeTruthy();
    expect(document.querySelector('.card-schematic [data-zone-colour="petrol"]')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("hort-zone-colours")!)).toEqual({ [id]: "petrol" });

    fireEvent.click(colorButton);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "No color" }));
    expect(zoneRow.querySelector("[data-zone-colour]")).toBeNull();
    expect(JSON.parse(localStorage.getItem("hort-zone-colours")!)).toEqual({});
  });
  test("the same local color may be used by several zones", () => {
    const first = "z-repeat-1", second = "z-repeat-2";
    renderApp(seeded({ zones: [zone(first, "Olive terrace"), zone(second, "Almond row")] }));
    for (const name of ["Olive terrace", "Almond row"]) {
      fireEvent.click(zonesCard().getByRole("button", { name: `Color for ${name}` }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Petrol" }));
    }
    expect(zonesCard().getByRole("button", { name: "Color for Olive terrace" }).closest("li")!.querySelector('[data-zone-colour="petrol"]')).toBeTruthy();
    expect(zonesCard().getByRole("button", { name: "Color for Almond row" }).closest("li")!.querySelector('[data-zone-colour="petrol"]')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("hort-zone-colours")!)).toEqual({ [first]: "petrol", [second]: "petrol" });
  });
  test("an archived snapshot drops its color and restoring starts gray", async () => {
    const id = "z-external-archive";
    setZoneColour(id, "petrol");
    const store = seeded({ zones: [zone(id, "Olive terrace", true)] });
    renderApp(store);
    await waitFor(() => expect(JSON.parse(localStorage.getItem("hort-zone-colours")!)).toEqual({}));

    act(() => store.replace(wire({ entities: eligibleEntities(), zones: [zone(id, "Olive terrace")] })));
    fireEvent.click(zonesCard().getByRole("button", { name: "Live" }));
    expect(zonesCard().getByRole("button", { name: "Color for Olive terrace" }).closest("li")!.querySelector("[data-zone-colour]")).toBeNull();
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
  test("archiving a zone is confirmed, frees its channel, and deletes its local color", async () => {
    const id = "z-archive";
    renderApp(seeded({ zones: [zone(id, "Olive terrace")], assignments: { 1: id } }));
    fireEvent.click(zonesCard().getByRole("button", { name: "Color for Olive terrace" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Petrol" }));
    expect(JSON.parse(localStorage.getItem("hort-zone-colours")!)).toEqual({ [id]: "petrol" });
    fireEvent.click(zonesCard().getByRole("button", { name: "Archive" }));
    expect(screen.getByText(/The channel feeding it will be left unassigned/)).toBeTruthy();
    expect(calls.some((call) => call.name === "archive-zone")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Archive zone" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "archive-zone", body: { id } }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("hort-zone-colours")!)).toEqual({}));
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
  // A schedule names a channel, so re-plumbing redirects the entries standing on
  // it. That is invisible in the click, so the editor says it (web ADR-0017).
  test("re-plumbing warns that the schedules on that channel move too", () => {
    renderApp(seeded({
      zones: [zone("z-olive", "Olive terrace"), zone("z-almond", "Almond row")],
      assignments: { 1: "z-olive" },
      schedules: [{ id: "s-1", time: "06:00", frequency: { kind: "weekdays", days: [2] }, channel: 1, recipe: { mode: "Volume", total: 200, preWetPercent: 20, flushMinutes: 5 } }],
    }));
    fireEvent.click(schematic().getByRole("button", { name: "Edit" }));
    expect(screen.queryByText(/Scheduled irrigations move too/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zone for Output 1" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Zone for Output 1" })).getByRole("option", { name: "Almond row" }));
    expect(screen.getByText(/1 schedule on Output 1 will water Almond row instead of Olive terrace/)).toBeTruthy();
  });
  test("editing assignments is refused while the pump runs", () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), pump: entity("ON") } }));
    expect(schematic().getByRole("button", { name: "Edit" }).hasAttribute("disabled")).toBe(true);
  });
  test("warns when the pump has no open path", () => {
    renderApp(seeded());
    expect(screen.getAllByText("no path").length).toBeGreaterThan(0);
  });
  // The device's default recipe is what the offline button waters with, so it
  // is edited among the device's own settings rather than on the Irrigation
  // card, where every run carries its own (controller ADR-0018).
  test("the default recipe's cycle mode posts immediately", async () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), default_cycle_mode: entity("Time") } }));
    selectFlow();
    fireEvent.change(screen.getByLabelText("Default cycle mode"), { target: { value: "Volume" } });
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "set-cycle-mode", body: { mode: "Volume" } }));
  });
  test("a default-recipe number debounces into a single command", async () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), default_flush_minutes: entity(5) } }));
    selectFlow();
    const input = screen.getByLabelText("default_flush_minutes");
    fireEvent.change(input, { target: { value: "6" } });
    fireEvent.change(input, { target: { value: "7" } });
    expect(calls).toHaveLength(0);
    await waitFor(() => expect(calls).toEqual([{ name: "set-flush-duration", body: { value: 7 } }]));
  });
  test("only offers Stop while irrigation is running", () => {
    renderApp(seeded({ entities: { ...eligibleEntities(), irrigation_running: entity("ON") } }));
    expect(screen.getByRole("button", { name: "Stop irrigation" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New irrigation" })).toBeNull();
  });
});

/**
 * Every run is a complete instruction: the channel *and* the recipe are inputs
 * carried on the start, so nothing a run does leaks into the next one
 * (controller ADR-0017, ADR-0018).
 */
describe("starting an irrigation now", () => {
  const withZones = (partial: Partial<WireSnapshot> = {}) => seeded({ zones: [zone("z-olive", "Olive terrace"), zone("z-almond", "Almond row")], assignments: { 1: "z-olive", 2: "z-almond" }, entities: { ...eligibleEntities(), default_cycle_mode: entity("Volume"), default_cycle_liters: entity(200), "default_pre-wet_percent": entity(20), default_flush_minutes: entity(5) }, ...partial });
  const irrigation = () => within(document.querySelector(".card-irrigation") as HTMLElement);
  const wizard = () => within(screen.getByRole("dialog"));
  const openWizard = () => fireEvent.click(irrigation().getByRole("button", { name: "New irrigation" }));
  const next = () => fireEvent.click(wizard().getByRole("button", { name: "Next" }));

  /**
   * Only assigned channels: scheduling water to a bare "Output 3" would name a
   * place the system cannot name, and the event would resolve to no zone.
   */
  test("the zone step offers assigned zones only, never a bare channel", () => {
    renderApp(withZones());
    openWizard(); next();
    expect(wizard().getByRole("button", { name: "Olive terrace" })).toBeTruthy();
    expect(wizard().getByRole("button", { name: "Almond row" })).toBeTruthy();
    expect(wizard().queryByRole("button", { name: "Output 3" })).toBeNull();
    expect(wizard().queryByRole("button", { name: "Output 4" })).toBeNull();
  });
  /**
   * The card is enabled by an operator-facing place existing, not by its wiring.
   * Assignment remains a later prerequisite and is explained on the Zone step.
   */
  test("one live zone enables the wizard even before it is assigned", () => {
    renderApp(seeded({ zones: [zone("z-olive", "Olive terrace")], assignments: {} }));
    const button = irrigation().getByRole("button", { name: "New irrigation" });
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button); next();
    expect(wizard().getByText(/No zone is assigned to an output yet/)).toBeTruthy();
    expect(wizard().getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
  });
  test("with no live zones there is nothing to open the wizard for", () => {
    renderApp(seeded({ zones: [zone("z-old", "Old row", true)], assignments: {} }));
    expect(irrigation().getByRole("button", { name: "New irrigation" }).hasAttribute("disabled")).toBe(true);
    expect(irrigation().getByText(/No zones yet/)).toBeTruthy();
  });
  test("a start carries the channel and the recipe together", async () => {
    renderApp(withZones());
    openWizard(); next();
    fireEvent.click(wizard().getByRole("button", { name: "Almond row" }));
    expect(calls).toHaveLength(0);
    next();
    // Nothing is chosen until it is chosen: the confirm is dead until then.
    expect(wizard().getByRole("button", { name: "Schedule irrigation" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(wizard().getByRole("button", { name: "Now" }));
    fireEvent.click(wizard().getByRole("button", { name: "Start irrigation" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "start-irrigation", body: { channel: 2, recipe: { mode: "Volume", total: 200, preWetPercent: 20, flushMinutes: 5 } } }));
  });
  // The step band is the restatement: the operator sees what they chose two
  // steps ago without a dialog stacked on the wizard repeating what they typed.
  test("the last step restates the zone and recipe chosen earlier", () => {
    renderApp(withZones());
    openWizard(); next();
    fireEvent.click(wizard().getByRole("button", { name: "Almond row" }));
    next();
    expect(wizard().getByText("Almond row")).toBeTruthy();
    expect(wizard().getByText(/200 L/)).toBeTruthy();
  });
  test("advancing past the zone step needs a zone", () => {
    renderApp(withZones());
    openWizard(); next();
    expect(wizard().getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
  });
  // Editing the recipe here must not write the device's defaults: it is this
  // run's recipe, and a one-off must not change what the button next waters.
  test("editing the recipe posts nothing until the run starts", async () => {
    renderApp(withZones());
    openWizard();
    fireEvent.click(wizard().getByRole("button", { name: "25%" }));
    fireEvent.change(wizard().getByLabelText("Cycle Mode"), { target: { value: "Time" } });
    await sleep(50);
    expect(calls).toHaveLength(0);
  });
  // Each opening is a fresh instruction; an abandoned draft must not resurface.
  test("reopening the wizard starts from the defaults again", () => {
    renderApp(withZones());
    openWizard(); next();
    fireEvent.click(wizard().getByRole("button", { name: "Almond row" }));
    fireEvent.click(wizard().getByRole("button", { name: "Back" }));
    fireEvent.click(wizard().getByRole("button", { name: "Cancel" }));
    openWizard();
    expect(wizard().getByText("1. Cycle")).toBeTruthy();
    next();
    expect(wizard().getByRole("button", { name: "Almond row" }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("scheduling an irrigation", () => {
  const zonesList = [zone("z-olive", "Olive terrace"), zone("z-almond", "Almond row")];
  const assignments = { 1: "z-olive", 2: "z-almond" };
  const recipe = { mode: "Volume" as const, total: 200, preWetPercent: 20, flushMinutes: 5 };
  const entry = (partial: Partial<WireSnapshot["schedules"][number]> = {}) => ({ id: "s-1", time: "06:00", frequency: { kind: "weekdays" as const, days: [2, 5] }, channel: 1 as const, recipe, ...partial });
  const withSchedules = (schedules: WireSnapshot["schedules"] = []) => seeded({ zones: zonesList, assignments, schedules, entities: { ...eligibleEntities(), default_cycle_mode: entity("Volume"), default_cycle_liters: entity(200), "default_pre-wet_percent": entity(20), default_flush_minutes: entity(5) } });
  const irrigation = () => within(document.querySelector(".card-irrigation") as HTMLElement);
  const wizard = () => within(screen.getByRole("dialog"));

  test("the card lists standing irrigations by zone, cadence and recipe", () => {
    renderApp(withSchedules([entry()]));
    expect(irrigation().getByText("Olive terrace")).toBeTruthy();
    expect(irrigation().getByText(/06:00 · Tue, Fri/)).toBeTruthy();
    expect(irrigation().getByText(/200 L · 20% pre-wet · 5 min flush/)).toBeTruthy();
  });
  test("an empty list says so rather than showing nothing", () => {
    renderApp(withSchedules());
    expect(irrigation().getByText("No scheduled irrigations yet.")).toBeTruthy();
  });
  test("scheduling carries the time, frequency, channel and recipe", async () => {
    renderApp(withSchedules());
    fireEvent.click(irrigation().getByRole("button", { name: "New irrigation" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Olive terrace" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Schedule" }));
    fireEvent.change(wizard().getByLabelText("Time of day"), { target: { value: "07:30" } });
    fireEvent.click(wizard().getByRole("button", { name: "Tue" }));
    fireEvent.click(wizard().getByRole("button", { name: "Fri" }));
    fireEvent.click(wizard().getByRole("button", { name: "Schedule irrigation" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "create-schedule", body: { time: "07:30", frequency: { kind: "weekdays", days: [2, 5] }, channel: 1, recipe } }));
  });
  /**
   * A recipe has a sensible default; a time of day does not. Opening on "06:00,
   * Tuesdays" would read as a decision the operator made.
   */
  test("the schedule step proposes nothing until asked", () => {
    renderApp(withSchedules());
    fireEvent.click(irrigation().getByRole("button", { name: "New irrigation" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Olive terrace" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    expect(wizard().getByRole("button", { name: "Now" }).getAttribute("aria-pressed")).toBe("false");
    expect(wizard().getByRole("button", { name: "Schedule" }).getAttribute("aria-pressed")).toBe("false");
    expect(wizard().queryByLabelText("Time of day")).toBeNull();
    fireEvent.click(wizard().getByRole("button", { name: "Schedule" }));
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(wizard().getByRole("button", { name: day }).getAttribute("aria-pressed")).toBe("false");
    }
  });
  // Every-N-days needs an anchor, so the cadence is a pure function of the date
  // and cannot drift when the controller is dark (controller ADR-0018).
  test("every-N-days carries its start date", async () => {
    renderApp(withSchedules());
    fireEvent.click(irrigation().getByRole("button", { name: "New irrigation" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Olive terrace" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Schedule" }));
    fireEvent.click(wizard().getByRole("button", { name: "Every N days" }));
    fireEvent.click(wizard().getByRole("button", { name: "Schedule irrigation" }));
    await waitFor(() => expect(calls.at(-1)?.name).toBe("create-schedule"));
    const body = calls.at(-1)!.body as { frequency: { kind: string; n: number; from: string } };
    expect(body.frequency.kind).toBe("everyN");
    expect(body.frequency.n).toBe(3);
    expect(body.frequency.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  // One pump: a second entry due at the same moment would be dropped as a
  // skipped run, so the clash is refused up front (controller ADR-0018). The
  // server enforces it; this only dims the affordance.
  test("a taken time slot is named and blocks the schedule", () => {
    renderApp(withSchedules([entry({ time: "06:00", frequency: { kind: "weekdays", days: [2] } })]));
    fireEvent.click(irrigation().getByRole("button", { name: "New irrigation" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Almond row" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Schedule" }));
    fireEvent.click(wizard().getByRole("button", { name: "Tue" }));
    expect(wizard().getByText(/06:00 is already taken by Olive terrace/)).toBeTruthy();
    expect(wizard().getByRole("button", { name: "Schedule irrigation" }).hasAttribute("disabled")).toBe(true);
  });
  test("moving off the taken day clears the clash", () => {
    renderApp(withSchedules([entry({ time: "06:00", frequency: { kind: "weekdays", days: [2] } })]));
    fireEvent.click(irrigation().getByRole("button", { name: "New irrigation" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Almond row" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Schedule" }));
    fireEvent.click(wizard().getByRole("button", { name: "Tue" }));
    fireEvent.click(wizard().getByRole("button", { name: "Tue" }));
    fireEvent.click(wizard().getByRole("button", { name: "Thu" }));
    expect(wizard().queryByText(/already taken/)).toBeNull();
    expect(wizard().getByRole("button", { name: "Schedule irrigation" }).hasAttribute("disabled")).toBe(false);
  });
  // A run now is not scheduled, so it cannot collide with a standing entry.
  test("starting now is never blocked by a taken slot", () => {
    renderApp(withSchedules([entry({ time: "06:00", frequency: { kind: "weekdays", days: [2] } })]));
    fireEvent.click(irrigation().getByRole("button", { name: "New irrigation" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Almond row" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Now" }));
    expect(wizard().getByRole("button", { name: "Start irrigation" }).hasAttribute("disabled")).toBe(false);
  });
  test("a schedule with no day selected cannot be created", () => {
    renderApp(withSchedules());
    fireEvent.click(irrigation().getByRole("button", { name: "New irrigation" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Olive terrace" }));
    fireEvent.click(wizard().getByRole("button", { name: "Next" }));
    fireEvent.click(wizard().getByRole("button", { name: "Schedule" }));
    expect(wizard().getByRole("button", { name: "Schedule irrigation" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(wizard().getByRole("button", { name: "Tue" }));
    expect(wizard().getByRole("button", { name: "Schedule irrigation" }).hasAttribute("disabled")).toBe(false);
  });
  // Entries are immutable, so deleting one is not undoable (web ADR-0017).
  test("deleting a schedule is confirmed and names what stops", async () => {
    renderApp(withSchedules([entry()]));
    fireEvent.click(irrigation().getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/Olive terrace will no longer be watered at 06:00/)).toBeTruthy();
    expect(calls.some((call) => call.name === "delete-schedule")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete schedule" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: "delete-schedule", body: { id: "s-1" } }));
  });
});
