import type { CycleRecipe, Frequency, OutputChannel, Zone } from "@hort/contracts";

/**
 * A wizard draft: the whole instruction, before it is either started or stored.
 * `when` and `time` start empty and `days` starts unselected — a wizard that
 * opens with "06:00, Tuesdays" already filled in reads as a decision the
 * operator made, and the one thing worse than no schedule is one they did not
 * realise they were agreeing to.
 */
export type Draft = {
  recipe: CycleRecipe;
  channel: OutputChannel | 0;
  when: "" | "now" | "future";
  /** Local wall-clock `HH:MM`, empty until set. */
  time: string;
  frequency: Frequency;
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const todayISO = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/**
 * A new irrigation starts from the device's default recipe, because those are
 * the values the operator last thought about and proposing them is not the same
 * as writing to them. The *schedule* is proposed with nothing at all: a recipe
 * has a sensible default, a time of day does not.
 */
export const draftFrom = (defaults: CycleRecipe, channel: OutputChannel | 0): Draft => ({
  recipe: defaults,
  channel,
  when: "",
  time: "",
  frequency: { kind: "weekdays", days: [] },
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
  if (!time) return [];
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

/**
 * The channels a scheduled or commanded run may water: only those with a zone on
 * them. An unassigned channel is deliberately absent — naming a bare "Output 3"
 * here would ask the operator to schedule water to a place the system cannot
 * name, and the record of that run would resolve to no zone. The manual button
 * on the box still waters whatever is open, so nothing is unreachable
 * (web ADR-0016).
 */
export const waterableChannels = (assignments: Record<number, string>): number[] =>
  Object.keys(assignments).map(Number).filter((channel) => assignments[channel]).sort((a, b) => a - b);

/** A draft is startable once every choice it needs has actually been made. */
export function draftBlocked(draft: Draft): string {
  if (!draft.channel) return "Choose a zone";
  if (!draft.when) return "Choose now or a schedule";
  if (draft.when === "now") return "";
  if (!draft.time) return "Set a time of day";
  if (draft.frequency.kind === "weekdays" && draft.frequency.days.length === 0) return "Choose at least one day";
  return "";
}
