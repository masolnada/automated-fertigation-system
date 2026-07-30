import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import Aedes from "aedes";
import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws"; import { Duplex } from "node:stream";
import mqtt, { type MqttClient } from "mqtt";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "../src/App";
import { DashboardStore, type Config, type PublishClient, resetIneligibleReason } from "@hort/mqtt";

const prefix = "test-hort";
const config: Config = { brokerUrl: "ws://unused", username: "u", password: "p", prefix };
let broker: Aedes, server: Server, wss: WebSocketServer, url = "";
const mqttClients: MqttClient[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

beforeAll(async () => { broker = new Aedes(); server = createServer(); wss = new WebSocketServer({ server }); wss.on("connection", (socket, request) => { const stream = new Duplex({ read() {}, write(chunk, _encoding, callback) { socket.send(chunk, callback); } }); socket.on("message", data => stream.push(Buffer.from(data as ArrayBuffer))); socket.on("close", () => stream.push(null)); socket.on("error", error => stream.destroy(error)); broker.handle(stream, request); }); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error("no address"); url = `ws://127.0.0.1:${address.port}`; });
afterEach(async () => { cleanup(); await Promise.all(mqttClients.splice(0).map(client => new Promise<void>(resolve => client.end(true, {}, () => resolve())))); });
afterAll(async () => { await new Promise<void>(resolve => wss.close(() => resolve())); await new Promise<void>(resolve => server.close(() => resolve())); await new Promise<void>(resolve => broker.close(() => resolve())); });
function ready(store = new DashboardStore()) { store.connected(); store.message(prefix, `${prefix}/status`, "online"); store.message(prefix, `${prefix}/switch/pump/state`, "OFF"); store.message(prefix, `${prefix}/sensor/flow_rate/state`, "0"); store.message(prefix, `${prefix}/sensor/total_water/state`, "12.3"); return store; }
function fakeClient(): [PublishClient, Array<[string, string, { retain?: boolean } | undefined]>] { const calls: Array<[string, string, { retain?: boolean } | undefined]> = []; return [{ publish: (topic, payload, options) => calls.push([topic, payload, options]) }, calls]; }

describe("broker-backed dashboard state", () => {
  test("retained state replay populates formatted values and invalidates on offline", async () => {
    for (const [topic, payload] of [[`${prefix}/status`, "online"], [`${prefix}/switch/pump/state`, "OFF"], [`${prefix}/sensor/flow_rate/state`, "1.25"], [`${prefix}/sensor/total_water/state`, "12.3"], [`${prefix}/sensor/battery_voltage/state`, "12.345"], [`${prefix}/number/pre-wet_minutes/state`, "5"]] as const) broker.publish({ cmd: "publish", qos: 0, dup: false, topic, payload, retain: true }, () => {});
    const store = new DashboardStore(); const client: MqttClient = mqtt.connect(url); mqttClients.push(client); client.on("connect", () => { store.connected(); client.subscribe(`${prefix}/#`); }); client.on("message", (topic, payload) => store.message(prefix, topic, payload.toString()));
    await waitFor(() => expect(store.getSnapshot().entities.battery_voltage?.value).toBe(12.345));
    const [fake] = fakeClient(); render(<App store={store} client={fake} config={config}/>);
    expect(screen.getByText("12.35")).toBeTruthy(); expect(screen.getByText("12.3")).toBeTruthy();
    store.message(prefix, `${prefix}/status`, "offline"); await waitFor(() => expect(screen.getAllByText("–").length).toBeGreaterThan(0)); expect(resetIneligibleReason(store.getSnapshot())).toBe("Device or broker offline");

  });
});

describe("dashboard interactions", () => {
  test("reset is non-retained, pending cannot close, and a result closes and logs", async () => {
    const store = ready(); const [client, calls] = fakeClient(); render(<App store={store} client={client} config={config}/>);
    fireEvent.click(screen.getByRole("button", { name: "Flow actions" })); fireEvent.click(screen.getByRole("menuitem", { name: "Reset total water" }));
    const dialog = screen.getByRole("dialog"); expect(dialog.getAttribute("aria-modal")).toBe("true"); expect(dialog.getAttribute("aria-labelledby")).toBe("dialog-title"); expect(dialog.getAttribute("aria-describedby")).toBe("dialog-message");
    fireEvent.click(screen.getByRole("button", { name: "Reset total" })); expect(calls[0]).toEqual([`${prefix}/flow/reset_total/request`, "ON", { retain: false }]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); fireEvent.keyDown(dialog, { key: "Escape" }); fireEvent.mouseDown(dialog.parentElement!, { target: dialog.parentElement }); expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => { store.handleResetResult("success"); }); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); expect(screen.getByText("total water reset")).toBeTruthy();
  });
  test("timeout releases a pending reset with the exact danger message", async () => { const store = ready(); const [client] = fakeClient(); render(<App store={store} client={client} config={config}/>); fireEvent.click(screen.getByRole("button", { name: "Flow actions" })); fireEvent.click(screen.getByRole("menuitem", { name: "Reset total water" })); fireEvent.click(screen.getByRole("button", { name: "Reset total" })); await sleep(10_050); expect(screen.getByText("No response from device. Check its connection and current total before retrying.")).toBeTruthy(); expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(false); }, 15_000);
  test("eligibility updates live and valve commands are exclusive", async () => {
    const store = ready(); const [client, calls] = fakeClient(); render(<App store={store} client={client} config={config}/>);
    fireEvent.click(screen.getByRole("button", { name: "Flow actions" })); fireEvent.click(screen.getByRole("menuitem", { name: "Reset total water" }));
    store.message(prefix, `${prefix}/sensor/flow_rate/state`, "1"); await waitFor(() => expect(screen.getByText("Reset unavailable: Flow active.")).toBeTruthy()); store.message(prefix, `${prefix}/sensor/flow_rate/state`, "0"); await waitFor(() => expect(screen.getByRole("button", { name: "Reset total" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Clean" })); expect(calls.at(-1)).toEqual([`${prefix}/switch/clean_water_valve/command`, "ON", undefined]); expect(screen.getByText("Switching… both valves close for a moment")).toBeTruthy();
    store.message(prefix, `${prefix}/switch/pump/state`, "ON"); await waitFor(() => expect(screen.getByText("Switching… both valves close for a moment, so the pump stops")).toBeTruthy()); fireEvent.click(screen.getByRole("button", { name: "Closed" })); expect(calls.slice(-2)).toEqual([[`${prefix}/switch/clean_water_valve/command`, "OFF", undefined], [`${prefix}/switch/fertigation_valve/command`, "OFF", undefined]]);
  });
  test("dialog traps enabled buttons and focus returns to its trigger", async () => { const store = ready(); const [client] = fakeClient(); render(<App store={store} client={client} config={config}/>); const trigger = screen.getByRole("button", { name: "Flow actions" }); fireEvent.click(trigger); fireEvent.click(screen.getByRole("menuitem", { name: "Reset total water" })); const dialog = screen.getByRole("dialog"); const confirm = screen.getByRole("button", { name: "Reset total" }); fireEvent.keyDown(confirm, { key: "Tab" }); expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" })); fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(confirm); fireEvent.click(screen.getByRole("button", { name: "Cancel" })); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); expect(document.activeElement).toBe(trigger); });
  test("focused duration input is not clobbered and Escape closes menu before dialog", async () => {
    const store = ready(); const [client] = fakeClient(); render(<App store={store} client={client} config={config}/>); const input = screen.getByLabelText(/Pre-wet/); input.focus(); fireEvent.change(input, { target: { value: "44" } }); store.message(prefix, `${prefix}/number/pre-wet_minutes/state`, "5"); expect((input as HTMLInputElement).value).toBe("44");
    const trigger = screen.getByRole("button", { name: "Flow actions" }); trigger.focus(); fireEvent.click(trigger); expect(screen.getByRole("menu")).toBeTruthy(); fireEvent.keyDown(document, { key: "Escape" }); await sleep(0); expect(screen.queryByRole("menu")).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
});
