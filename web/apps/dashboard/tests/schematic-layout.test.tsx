import { describe, expect, test, afterEach } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Schematic } from "@hort/ui";
import { SchematicCard } from "../src/cards/SchematicCard/SchematicCard";
import { SnapshotStore } from "../src/store";


function setWidth(px: number) {
  (window as any).innerWidth = px;
  window.matchMedia = ((q: string) => {
    const m = /max-width:\s*(\d+)px/.exec(q);
    return { matches: m ? px <= Number(m[1]) : false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}
const props = {
  activeSource: "" as const, selectedZone: 0, pumpOn: false, flowRate: "0.0",
  zoneNames: { 1: "Olive terrace" }, sourceLabels: { clean_water_valve: "Clean water", fertigation_valve: "Fertigation", microbiology_valve: "Microbiology" },
  selected: "flow" as const, onSelect() {}, onSelectSource() {}, onSelectZone() {}, onTogglePump() {},
  blockedReason: "Open one source and one zone.",
};
afterEach(cleanup);

const snap = () => { const s = new SnapshotStore(); s.replace({ brokerConnected: true, deviceOnline: true, entities: { pump: { value: "OFF", known: true }, flow_rate: { value: 0, known: true }, total_water: { value: 12, known: true }, min_flow: { value: 0.5, known: true } }, valves: { clean_water_valve: false, fertigation_valve: false, microbiology_valve: false }, selectedZone: 0, zoneNames: { 1: "Olive terrace" }, resetPending: false, log: [] }); return s.getSnapshot(); };
const noop = () => {};


describe("schematic layouts", () => {
  test("phone width renders the stacked pipeline with no fixed-width diagram", () => {
    setWidth(390);
    const { container } = render(<Schematic {...props}><p>panel</p></Schematic>);
    expect(screen.getByText("Olive terrace")).toBeTruthy();
    expect(screen.getByText("panel")).toBeTruthy();
    const wide = [...container.querySelectorAll<HTMLElement>("[style]")].filter((el) => /width:\s*(1[0-9][0-9]|[2-9][0-9][0-9])px/.test(el.getAttribute("style") ?? ""));
    expect(wide).toHaveLength(0);
  });
  test("desktop width renders the flow diagram", () => {
    setWidth(1400);
    const { container } = render(<Schematic {...props}><p>panel</p></Schematic>);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(1);
    expect(screen.getByText("Sources")).toBeTruthy();
  });
  // The hover dialog needs a pointer, so the blocked reason must also reach the
  // button's accessible name or it is lost on a touch screen.
  test("the blocked pump names its reason without opening the dialog", () => {
    setWidth(1400);
    render(<Schematic {...props}><p>panel</p></Schematic>);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("button", { name: /Pump/ }).textContent).toContain("Cannot run. Open one source and one zone.");
  });
  test("an open path leaves no warning on the pump", () => {
    setWidth(1400);
    render(<Schematic {...props} activeSource="clean_water_valve" selectedZone={1}><p>panel</p></Schematic>);
    expect(screen.getByRole("button", { name: /Pump/ }).textContent).not.toContain("Cannot run");
  });
});

describe("schematic card on a phone", () => {
  test("renders every control and the panel with no fixed-width element", () => {
    setWidth(390);
    const { container } = render(<QueryClientProvider client={new QueryClient()}><SchematicCard snapshot={snap()} onSelectValve={noop} onSelectZone={noop} onTogglePump={noop} onZoneName={noop} onMinFlow={noop}/></QueryClientProvider>);
    for (const label of ["Clean water", "Fertigation", "Microbiology", "Olive terrace", "Zone 2", "Zone 3", "Zone 4"]) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText("no path")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Flow/ }));
    expect(screen.getByRole("button", { name: "Reset total water" })).toBeTruthy();
    const wide = [...container.querySelectorAll<HTMLElement>("[style]")].filter((el) => /width:\s*(1[5-9][0-9]|[2-9][0-9][0-9])px/.test(el.getAttribute("style") ?? ""));
    expect(wide).toHaveLength(0);
  });
});
