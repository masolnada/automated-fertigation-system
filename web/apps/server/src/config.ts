export type Config = { brokerUrl: string; username: string; password: string; prefix: string; port: number; dbPath: string };

/** Validate the server's own environment at boot. Credentials are server-only. */
export function parseConfig(env: Record<string, string | undefined>): Config {
  const fields = { brokerUrl: env.MQTT_URL, username: env.MQTT_USERNAME, password: env.MQTT_PASSWORD, prefix: env.MQTT_PREFIX };
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== "string" || value.trim() === "" || value.includes("${")) throw new Error(`Invalid config field: ${field}`);
  }
  const port = Number.parseInt(env.PORT ?? "4000", 10);
  if (!Number.isInteger(port) || port <= 0) throw new Error("Invalid config field: PORT");
  const dbPath = env.DB_PATH?.trim() || "./data/hort.db";
  return { ...(fields as Omit<Config, "port" | "dbPath">), port, dbPath };
}
