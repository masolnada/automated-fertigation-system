import { defineConfig } from "drizzle-kit";

// Only drives `drizzle-kit generate` (SQL diff → ./drizzle). The runtime opens
// its own connection and applies migrations in database.ts.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/infrastructure/db/schema.ts",
  out: "./drizzle",
});
