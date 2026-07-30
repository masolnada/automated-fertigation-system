export type Config = { brokerUrl: string; username: string; password: string; prefix: string };

export function parseConfig(input: unknown): Config {
  if (!input || typeof input !== "object") throw new Error("config must be an object");
  const source = input as Record<string, unknown>;
  const fields = { brokerUrl: source.brokerUrl ?? source.MQTT_URL, username: source.username ?? source.MQTT_USERNAME, password: source.password ?? source.MQTT_PASSWORD, prefix: source.prefix ?? source.MQTT_PREFIX };
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== "string" || value.trim() === "" || value.includes("${")) throw new Error(`Invalid config field: ${field}`);
  }
  return fields as Config;
}
