import mqtt, { type MqttClient } from "mqtt";
import type { DevicePort } from "../../application/ports/device-port";
import { topics } from "../../application/controller-protocol";
import type { Config } from "../../config";
import type { ControllerSnapshotProjection } from "../projections/controller-snapshot-projection";
import { parseStateTopic } from "./topics";

export class MqttDevice implements DevicePort {
  readonly prefix: string;
  private client: MqttClient;
  private resetListeners = new Set<(result: string) => void>();
  private wateringLogListeners = new Set<(payload: string) => void>();

  constructor(config: Config, private controller: ControllerSnapshotProjection) {
    this.prefix = config.prefix;
    this.client = mqtt.connect(config.brokerUrl, { username: config.username, password: config.password, reconnectPeriod: 3000, keepalive: 30 });
    this.client.on("connect", () => { this.controller.connected(); this.client.subscribe(topics(this.prefix).subscribe); });
    this.client.on("close", () => this.controller.closed());
    this.client.on("error", (error) => this.controller.error(error));
    this.client.on("message", (topic, payload) => this.onMessage(topic, payload.toString()));
  }
  private onMessage(topic: string, payload: string): void {
    this.controller.message(this.prefix, topic, payload);
    const type = parseStateTopic(this.prefix, topic).type;
    if (type === "resetResult") this.resetListeners.forEach((listener) => listener(payload));
    if (type === "wateringLog") this.wateringLogListeners.forEach((listener) => listener(payload));
  }
  publish(topic: string, payload: string, options?: { retain?: boolean }): void { this.client.publish(topic, payload, { retain: options?.retain ?? false }); }
  onResetResult(callback: (result: string) => void): () => void { this.resetListeners.add(callback); return () => { this.resetListeners.delete(callback); }; }
  onWateringLog(callback: (payload: string) => void): () => void { this.wateringLogListeners.add(callback); return () => { this.wateringLogListeners.delete(callback); }; }
  close(): void { this.client.end(true); }
}
