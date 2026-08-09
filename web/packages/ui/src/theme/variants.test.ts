import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { variants } from "./variants";

const palette = /^(?:(active|disabled):)?(bg|text|border)-(ink|paper|gray|action|danger)$/;
function expectUnambiguousPalette(classes: string) {
  const properties = new Set<string>();
  for (const token of classes.split(/\s+/)) {
    const match = token.match(palette);
    if (!match) continue;
    const property = `${match[1] ?? "default"}:${match[2]}`;
    expect(properties.has(property)).toBeFalse();
    properties.add(property);
  }
}

describe("e-ink theme", () => {
  test("loads Tailwind preflight between theme and utilities", async () => {
    const css = await readFile(new URL("./eink.css", import.meta.url), "utf8");
    expect(css).toMatch(/theme\.css" layer\(theme\);\s*@import "tailwindcss\/preflight\.css" layer\(base\);\s*@import "tailwindcss\/utilities\.css" layer\(utilities\);/);
  });

  test("state palettes have one foreground, background, and border per state", () => {
    const states = [
      variants.button.default,
      variants.button.primary,
      variants.button.danger,
      variants.badge.off,
      variants.badge.on,
      variants.badge.online,
      variants.badge.offline,
      variants.phase.normal,
      variants.phase.fertigation,
      variants.valve.inactive,
      variants.valve.active,
      variants.valve.pending,
      variants.relay.off,
      variants.relay.on,
      variants.events.normal,
      variants.events.danger,
    ];
    for (const state of states) expectUnambiguousPalette(state);
  });
});
