import { describe, expect, test, afterEach } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Schematic } from "@hort/ui";
import { SchematicCard } from "../src/cards/SchematicCard/SchematicCard";
import { SnapshotStore } from "../src/store";


const realMatchMedia = window.matchMedia;
function setWidth(px: number) {
  (window as any).innerWidth = px;
  window.matchMedia = ((q: string) => {
    const m = /max-width:\s*(\d+)px/.exec(q);
    return { matches: m ? px <= Number(m[1]) : false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}
// The stub is global, so leaving it in place decides the viewport for every
// later file.
afterEach(() => { window.matchMedia = realMatchMedia; });
const props = {
  activeSource: "" as const, selectedOutput: 0, pumpOn: false, flowRate: "0.0",
  outputLabels: { 1: "Olive terrace" }, sourceLabels: { clean_water_valve: "Clean water", fertigation_valve: "Fertigation", microbiology_valve: "Microbiology" },
  selected: "flow" as const, onSelect() {}, onSelectSource() {}, onSelectOutput() {}, onTogglePump() {},
  blockedReason: "Open one source and one output.",
};
afterEach(cleanup);

const zones = [{ id: "z-olive", name: "Olive terrace", archived: false }];
const snap = () => { const s = new SnapshotStore(); s.replace({ brokerConnected: true, deviceOnline: true, entities: { pump: { value: "OFF", known: true }, flow_rate: { value: 0, known: true }, total_water: { value: 12, known: true }, min_flow: { value: 0.5, known: true } }, valves: { clean_water_valve: false, fertigation_valve: false, microbiology_valve: false }, selectedOutput: 0, zones, assignments: { 1: "z-olive" }, resetPending: false, schedules: [], log: [] }); return s.getSnapshot(); };
const noop = () => {};


describe("schematic layouts", () => {
  test("phone width renders the stacked pipeline with no fixed-width diagram", () => {
    setWidth(390);
    const { container } = render(<Schematic {...props}/>);
    expect(screen.getByText("Olive terrace")).toBeTruthy();
    const wide = [...container.querySelectorAll<HTMLElement>("[style]")].filter((el) => /width:\s*(1[0-9][0-9]|[2-9][0-9][0-9])px/.test(el.getAttribute("style") ?? ""));
    expect(wide).toHaveLength(0);
  });
  test("desktop width renders the flow diagram", () => {
    setWidth(1400);
    const { container } = render(<Schematic {...props}/>);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(1);
    expect(screen.getByText("Sources")).toBeTruthy();
  });
  // An output channel with no zone assigned still waters (web ADR-0014), so it
  // must stay labelled and operable rather than blank.
  test("an unassigned output channel falls back to its channel label", () => {
    setWidth(1400);
    render(<Schematic {...props}/>);
    for (const label of ["Olive terrace", "Output 2", "Output 3", "Output 4"]) expect(screen.getByText(label)).toBeTruthy();
  });
  // The hover dialog needs a pointer, so the blocked reason must also reach the
  // button's accessible name or it is lost on a touch screen.
  test("the blocked pump names its reason without opening the dialog", () => {
    setWidth(1400);
    render(<Schematic {...props}/>);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("button", { name: /Pump/ }).textContent).toContain("Cannot run. Open one source and one output.");
  });
  test("an open path leaves no warning on the pump", () => {
    setWidth(1400);
    render(<Schematic {...props} activeSource="clean_water_valve" selectedOutput={1}/>);
    expect(screen.getByRole("button", { name: /Pump/ }).textContent).not.toContain("Cannot run");
  });
});

describe("schematic card on a phone", () => {
  test("renders every control with no fixed-width element", () => {
    setWidth(390);
    const { container } = render(<QueryClientProvider client={new QueryClient()}><SchematicCard snapshot={snap()} onSelectValve={noop} onSelectOutput={noop} onTogglePump={noop} onSetAssignments={noop} onMinFlow={noop} onCycleMode={noop} onCycleTarget={noop} onPreWet={noop} onFlush={noop}/></QueryClientProvider>);
    // The assignation editor lists the same names, so scope to the diagram.
    const diagram = within(container.querySelector(".card-schematic > div") as HTMLElement);
    for (const label of ["Clean water", "Fertigation", "Microbiology", "Olive terrace", "Output 2", "Output 3", "Output 4"]) expect(diagram.getByText(label)).toBeTruthy();
    expect(screen.getByText("no path")).toBeTruthy();
    const wide = [...container.querySelectorAll<HTMLElement>("[style]")].filter((el) => /width:\s*(1[5-9][0-9]|[2-9][0-9][0-9])px/.test(el.getAttribute("style") ?? ""));
    expect(wide).toHaveLength(0);
  });
  // The diagram carries no info panel, so the flow node's settings are a modal.
  test("selecting the flow node opens the flow settings", () => {
    setWidth(390);
    render(<QueryClientProvider client={new QueryClient()}><SchematicCard snapshot={snap()} onSelectValve={noop} onSelectOutput={noop} onTogglePump={noop} onSetAssignments={noop} onMinFlow={noop} onCycleMode={noop} onCycleTarget={noop} onPreWet={noop} onFlush={noop}/></QueryClientProvider>);
    expect(screen.getByLabelText("Min Flow").closest("dialog")?.open).toBeFalsy();
    fireEvent.click(screen.getByRole("button", { name: /Flow/ }));
    expect(screen.getByLabelText("Min Flow").closest("dialog")?.open).toBe(true);
    expect(screen.getByRole("button", { name: "Reset total water" })).toBeTruthy();
  });
});
