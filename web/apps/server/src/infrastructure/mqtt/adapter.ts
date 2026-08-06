import mqtt, { type MqttClient } from "mqtt";
import type { Controller } from "../../domain/controller";
import type { DevicePort } from "../../domain/ports";
import { parseStateTopic, topics } from "../../domain/topics";
import type { Config } from "../../config";

/**
 * The only MQTT client. Owns the connection, folds raw topics into the read
 * model, tracks broker/device connectivity, and surfaces reset results to the
 * application. Coalescing of downstream pushes lives in the Controller.
 */
export class MqttDevice implements DevicePort {
  readonly prefix: string;
  private client: MqttClient;
  private resetListeners = new Set<(result: string) => void>();

  constructor(config: Config, private controller: Controller) {
    this.prefix = config.prefix;
    this.client = mqtt.connect(config.brokerUrl, { username: config.username, password: config.password, reconnectPeriod: 3000, keepalive: 30 });
    this.client.on("connect", () => { this.controller.connected(); this.client.subscribe(topics(this.prefix).subscribe); });
    this.client.on("close", () => this.controller.closed());
    this.client.on("error", (error) => this.controller.error(error));
    this.client.on("message", (topic, payload) => this.onMessage(topic, payload.toString()));
  }

  private onMessage(topic: string, payload: string): void {
    this.controller.message(this.prefix, topic, payload);
    if (parseStateTopic(this.prefix, topic).type === "resetResult") this.resetListeners.forEach((listener) => listener(payload));
  }

  publish(topic: string, payload: string, options?: { retain?: boolean }): void { this.client.publish(topic, payload, { retain: options?.retain ?? false }); }
  onResetResult(callback: (result: string) => void): () => void { this.resetListeners.add(callback); return () => { this.resetListeners.delete(callback); }; }
  close(): void { this.client.end(true); }
}
