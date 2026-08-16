import type { CycleRecipe, Frequency, OutputChannel, Zone } from "@hort/contracts";

/** A wizard draft: the whole instruction, before it is either started or stored. */
export type Draft = {
  recipe: CycleRecipe;
  channel: OutputChannel | 0;
  when: "now" | "future";
  /** Local wall-clock `HH:MM`. */
  time: string;
  frequency: Frequency;
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const todayISO = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/**
 * A new irrigation starts from the device's default recipe — the `cycle_*`
 * entities — because those are the values the operator last thought about, and
 * proposing them is not the same as writing to them. Nothing here is committed
 * until the wizard's last step.
 */
export const draftFrom = (defaults: CycleRecipe, channel: OutputChannel | 0): Draft => ({
  recipe: defaults,
  channel,
  when: "future",
  time: "06:00",
  frequency: { kind: "weekdays", days: [2] },
});

export const recipeUnit = (recipe: CycleRecipe) => (recipe.mode === "Volume" ? "L" : "min");

export function frequencyText(frequency: Frequency): string {
  if (frequency.kind === "everyN") {
    const [year, month, day] = frequency.from.split("-");
    const from = `${day}-${month}-${year}`;
    return frequency.n === 1 ? `Every day, from ${from}` : `Every ${frequency.n} days, from ${from}`;
  }
  const days = [...frequency.days].sort((a, b) => a - b);
  if (days.length === 7) return "Every day";
  if (days.length === 0) return "No days chosen";
  if (days.length === 5 && days.every((day) => day <= 5)) return "Weekdays";
  return days.map((day) => WEEKDAYS[day - 1]).join(", ");
}

export const recipeText = (recipe: CycleRecipe) =>
  `${recipe.total} ${recipeUnit(recipe)} · ${recipe.preWetPercent}% pre-wet · ${recipe.flushMinutes} min flush`;

/**
 * The next dates an entry fires on. Both frequency forms are pure functions of
 * the date, so this is the same question the controller answers from its RTC —
 * shown because "every 3 days from 14-03" is hard to picture otherwise.
 */
export function nextDates(frequency: Frequency, time: string, count = 4): string[] {
  const dates: string[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < 400 && dates.length < count; offset++) {
    const day = new Date(start.getTime() + offset * 86_400_000);
    let fires: boolean;
    if (frequency.kind === "weekdays") {
      fires = frequency.days.includes(((day.getDay() + 6) % 7) + 1);
    } else {
      const anchor = new Date(`${frequency.from}T00:00:00`);
      const diff = Math.round((day.getTime() - anchor.getTime()) / 86_400_000);
      fires = diff >= 0 && diff % Math.max(frequency.n, 1) === 0;
    }
    if (fires) dates.push(`${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "2-digit" }).format(day)} ${time}`);
  }
  return dates;
}

/**
 * What to call the place a channel waters. The dashboard speaks zones, falling
 * back to the bare channel only where none is assigned — which is also the
 * visible prompt to go and assign it (web ADR-0016).
 */
export const channelName = (zones: Zone[], assignments: Record<number, string>, channel: number) =>
  zones.find((zone) => zone.id === assignments[channel])?.name ?? `Output ${channel}`;

/** A draft is startable once it names a channel and a frequency that fires at all. */
export function draftBlocked(draft: Draft): string {
  if (!draft.channel) return "Choose a zone";
  if (draft.when === "future" && draft.frequency.kind === "weekdays" && draft.frequency.days.length === 0) return "Choose at least one day";
  return "";
}
