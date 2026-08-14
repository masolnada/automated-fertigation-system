import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { variants } from "./variants";

const palette = /^(?:(active|disabled):)?(bg|text|border)-(ink|paper|gray|action|connected|warning|danger|water)$/;
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

describe("paper theme", () => {
  test("loads Tailwind preflight between theme and utilities", async () => {
    const css = await readFile(new URL("./eink.css", import.meta.url), "utf8");
    expect(css).toMatch(/theme\.css" layer\(theme\);\s*@import "tailwindcss\/preflight\.css" layer\(base\);\s*@import "tailwindcss\/utilities\.css" layer\(utilities\);/);
  });

  // The reset must EXCLUDE opted-in elements rather than try to undo itself: an
  // `[data-motion] { animation: revert }` override resolves to the UA default
  // (none) and silently kills the animation it was meant to restore.
  test("motion reset exempts data-motion instead of overriding it", async () => {
    const css = await readFile(new URL("./eink.css", import.meta.url), "utf8");
    expect(css).toMatch(/\*:not\(\[data-motion\]\)\s*\{[^}]*animation:\s*none\s*!important/);
    expect(css).not.toMatch(/\[data-motion\]\s*\{[^}]*animation:\s*revert/);
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
      variants.select.trigger,
      variants.select.optionOff,
      variants.select.optionOn,
    ];
    for (const state of states) expectUnambiguousPalette(state);
  });
});
