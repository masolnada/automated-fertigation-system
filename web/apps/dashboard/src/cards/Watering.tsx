import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardTitle } from "@hort/ui";
import type { WateringEvent, WateringHistory } from "@hort/contracts";
import { zoneNumbers } from "@hort/contracts";
import { PrototypeSwitcher } from "../PrototypeSwitcher";
import { ALL_ZONES, NO_ZONE, ZoneScopeBanner, ZoneSegments, ZoneStrips, matchesZone, useZoneFilterVariant, zoneFilterVariants, type ZoneStat } from "./WateringZoneFilterVariants";
import "./watering.css";

const TIME_ZONE = "Europe/Madrid";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const OUTCOME_LABEL: Record<WateringEvent["outcome"], string> = { completed: "Completed", aborted: "Aborted", dry_run: "Dry run", recovery: "Recovery" };
const icon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/><path d="M12 8v8"/><path d="M8.5 12.5 12 16l3.5-3.5"/></svg>;

type DaySummary = { key: string; litres: number; waterings: number; issues: number; events: WateringEvent[] };
/** The name an event ran under, or a fallback when the controller recorded no zone. */
const zoneLabel = (event: WateringEvent) => event.zoneName ?? (event.zone ? `Zone ${event.zone}` : "No zone");

function pad(value: number): string { return String(value).padStart(2, "0"); }
function dateKey(year: number, month: number, day: number): string { return `${year}-${pad(month)}-${pad(day)}`; }
function parts(key: string): [number, number, number] { const [year, month, day] = key.split("-").map(Number); return [year!, month!, day!]; }
function utcDate(key: string): Date { const [year, month, day] = parts(key); return new Date(Date.UTC(year, month - 1, day)); }
function daysInMonth(year: number, month: number): number { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function mondayIndex(key: string): number { return (utcDate(key).getUTCDay() + 6) % 7; }
function keyInTimeZone(date: Date): string {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function displayDate(key: string): string { const [year, month, day] = parts(key); return `${pad(day)}-${pad(month)}-${year}`; }
function fullDate(key: string): string { return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${key}T10:00:00.000Z`)); }
function eventTime(value: string | null): string { if (!value) return "Time unknown"; return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function eventDuration(event: WateringEvent): string {
  if (!event.startedAt || !event.endedAt) return "–";
  const minutes = Math.round((new Date(event.endedAt).getTime() - new Date(event.startedAt).getTime()) / 60_000);
  return Number.isFinite(minutes) && minutes >= 0 ? `${minutes} min` : "–";
}
function level(litres: number): number {
  if (!(litres > 0)) return 0;
  if (litres <= 50) return 1;
  if (litres <= 100) return 2;
  if (litres <= 200) return 3;
  if (litres <= 500) return 4;
  return 5;
}
function yearRange(year: number): { since: string; until: string } {
  return {
    since: new Date(`${year}-01-01T00:00:00+01:00`).toISOString(),
    until: new Date(`${year + 1}-01-01T00:00:00+01:00`).toISOString(),
  };
}
function clampSelection(year: number, selectedKey: string, todayKey: string): string {
  const [, month, day] = parts(selectedKey);
  const candidate = dateKey(year, month, Math.min(day, daysInMonth(year, month)));
  return year === Number(todayKey.slice(0, 4)) && candidate > todayKey ? todayKey : candidate;
}
function elapsed(event: WateringEvent | null, now: number): string {
  if (!event) return "No watering recorded";
  if (!event.endedAt) return "Time unknown";
  const endedAt = new Date(event.endedAt).getTime();
  if (!Number.isFinite(endedAt) || endedAt > now) return "Time invalid";
  const minutes = Math.floor((now - endedAt) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} d${hours % 24 ? ` ${hours % 24} h` : ""} ago`;
}
function validHistory(value: unknown): value is WateringHistory {
  if (!value || typeof value !== "object") return false;
  const history = value as Partial<WateringHistory>;
  return Array.isArray(history.chartEvents)
    && (history.lastWatering === null || typeof history.lastWatering === "object")
    && (history.earliestEventAt === null || (typeof history.earliestEventAt === "string" && Number.isFinite(new Date(history.earliestEventAt).getTime())));
}
/**
 * Per-zone litres for one day, largest first. Grouped by numeric zone, so a day
 * spanning a rename shows one row; the label is the event's own historical name
 * (web ADR-0010), taken from the latest event of that zone in the day.
 */
function byZone(events: WateringEvent[]): Array<{ zone: number; label: string; litres: number; count: number }> {
  const totals = new Map<number, { zone: number; label: string; litres: number; count: number }>();
  for (const event of events) {
    const zone = event.zone ?? NO_ZONE;
    const entry = totals.get(zone) ?? { zone, label: zoneLabel(event), litres: 0, count: 0 };
    entry.label = zoneLabel(event);
    entry.litres += event.litresDelivered;
    entry.count++;
    totals.set(zone, entry);
  }
  return [...totals.values()].sort((a, b) => b.litres - a.litres);
}

/**
 * PROTOTYPE: per-zone totals for the loaded year, keyed on the numeric zone.
 * `label` is the zone's current name (from the live snapshot where known, else
 * the most recent event's name); `aliases` are the other names its events ran
 * under this year, which is what makes the rename behaviour visible.
 */
function zoneStats(events: WateringEvent[], currentNames: Record<number, string>): ZoneStat[] {
  const stats = new Map<number, ZoneStat & { latestAt: number }>();
  for (const zone of zoneNumbers) stats.set(zone, { zone, label: currentNames[zone] ?? `Zone ${zone}`, litres: 0, events: 0, aliases: [], latestAt: -Infinity });
  const seen = new Map<number, Set<string>>();
  for (const event of events) {
    const zone = event.zone ?? NO_ZONE;
    const stat = stats.get(zone) ?? { zone, label: zoneLabel(event), litres: 0, events: 0, aliases: [], latestAt: -Infinity };
    stat.litres += event.litresDelivered;
    stat.events++;
    const at = event.endedAt ? new Date(event.endedAt).getTime() : -Infinity;
    // No live name for a zone the controller no longer reports: fall back to the
    // most recent name its own events carry.
    if (at > stat.latestAt && !currentNames[zone]) { stat.label = zoneLabel(event); stat.latestAt = at; }
    const names = seen.get(zone) ?? new Set<string>();
    if (event.zoneName) names.add(event.zoneName);
    seen.set(zone, names);
    stats.set(zone, stat);
  }
  for (const [zone, names] of seen) {
    const stat = stats.get(zone);
    if (stat) stat.aliases = [...names].filter((name) => name !== stat.label).sort();
  }
  return [...stats.values()].map(({ latestAt: _latestAt, ...stat }) => stat).sort((a, b) => a.zone - b.zone);
}

function summarize(events: WateringEvent[]): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>();
  for (const event of events) {
    if (!event.endedAt) continue;
    const endedAt = new Date(event.endedAt);
    if (!Number.isFinite(endedAt.getTime())) continue;
    const key = keyInTimeZone(endedAt);
    const summary = days.get(key) ?? { key, litres: 0, waterings: 0, issues: 0, events: [] };
    summary.litres += event.litresDelivered;
    if (event.litresDelivered > 0) summary.waterings++;
    if (event.outcome !== "completed") summary.issues++;
    summary.events.push(event);
    days.set(key, summary);
  }
  return days;
}

function YearControl({ year, currentYear, earliestYear, onYear }: { year: number; currentYear: number; earliestYear: number; onYear(year: number): void }) {
  return <div className="watering-year-control" aria-label="Calendar year">
    <button type="button" disabled={year <= earliestYear} onClick={() => onYear(year - 1)} aria-label="Previous year">←</button>
    <strong>{year}</strong>
    <button type="button" disabled={year >= currentYear} onClick={() => onYear(year + 1)} aria-label="Next year">→</button>
  </div>;
}

function YearHeatmap({ year, selectedKey, todayKey, days, disabled, onSelect }: { year: number; selectedKey: string; todayKey: string; days: Map<string, DaySummary>; disabled: boolean; onSelect(key: string): void }) {
  const leading = mondayIndex(dateKey(year, 1, 1));
  const dayCount = daysInMonth(year, 2) === 29 ? 366 : 365;
  const cells: Array<string | null> = Array.from({ length: leading }, () => null);
  for (let index = 0; index < dayCount; index++) {
    const date = new Date(Date.UTC(year, 0, index + 1));
    cells.push(dateKey(year, date.getUTCMonth() + 1, date.getUTCDate()));
  }
  while (cells.length % 7) cells.push(null);
  const weekCount = cells.length / 7;
  const columns = `repeat(${weekCount}, minmax(0, 1fr))`;
  const monthPositions = MONTHS.map((label, monthIndex) => {
    const dayIndex = Math.round((Date.UTC(year, monthIndex, 1) - Date.UTC(year, 0, 1)) / 86_400_000);
    return { label, column: Math.floor((leading + dayIndex) / 7) + 1 };
  });

  return <div className="watering-heatmap-shell">
    <p id="watering-heatmap-scale" className="watering-visually-hidden">Daily water delivered: white is zero litres; five green levels represent more than zero to 50, more than 50 to 100, more than 100 to 200, more than 200 to 500, and more than 500 litres. A red border means at least one event did not complete normally.</p>
    <div className="watering-month-labels" style={{ gridTemplateColumns: columns }}>
      {monthPositions.map(({ label, column }) => <span key={label} style={{ gridColumn: `${column} / span 4` }}>{label}</span>)}
    </div>
    <div className="watering-heatmap-body">
      <div className="watering-weekdays" aria-hidden="true"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span></span></div>
      <div className="watering-heatmap-grid" role="grid" aria-label={`${year} daily water delivered`} aria-describedby="watering-heatmap-scale" style={{ gridTemplateColumns: columns }}>
        {cells.map((key, index) => {
          if (!key) return <span className="watering-heatmap-placeholder" key={`empty-${index}`} aria-hidden="true"></span>;
          const summary = days.get(key);
          const future = key > todayKey;
          const selected = key === selectedKey;
          const today = key === todayKey;
          const litres = summary?.litres ?? 0;
          const waterings = summary?.waterings ?? 0;
          const issues = summary?.issues ?? 0;
          const label = `${displayDate(key)}: ${litres.toFixed(1)} litres, ${waterings} watering ${waterings === 1 ? "event" : "events"}, ${issues} ${issues === 1 ? "error" : "errors"}`;
          return <button type="button" role="gridcell" key={key} disabled={future || disabled} aria-label={label} aria-selected={selected} title={label} onClick={() => onSelect(key)} className={`watering-heatmap-cell watering-level-${level(litres)}${issues ? " watering-cell-error" : ""}${selected ? " watering-cell-selected" : ""}${today && !selected ? " watering-cell-today" : ""}`}></button>;
        })}
      </div>
    </div>
  </div>;
}

function MonthFocus({ selectedKey, todayKey, days, disabled, onSelect }: { selectedKey: string; todayKey: string; days: Map<string, DaySummary>; disabled: boolean; onSelect(key: string): void }) {
  const [year, month] = parts(selectedKey);
  const leading = mondayIndex(dateKey(year, month, 1));
  const cells: Array<number | null> = [...Array.from({ length: leading }, () => null), ...Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  return <section className="watering-month-focus" aria-labelledby="watering-month-title">
    <span className="watering-kicker">Selected month</span>
    <h3 id="watering-month-title">{MONTHS_LONG[month - 1]} {year}</h3>
    <div className="watering-month-weekdays" aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
    <div className="watering-month-grid">
      {cells.map((day, index) => {
        if (!day) return <span key={`empty-${index}`}></span>;
        const key = dateKey(year, month, day);
        const summary = days.get(key);
        const future = key > todayKey;
        const selected = key === selectedKey;
        const litres = summary?.litres ?? 0;
        const issues = summary?.issues ?? 0;
        return <button type="button" key={key} disabled={future || disabled} aria-label={`${displayDate(key)}: ${litres.toFixed(1)} litres`} aria-pressed={selected} onClick={() => onSelect(key)} className={`watering-month-day watering-level-${level(litres)}${issues ? " watering-cell-error" : ""}${selected ? " watering-cell-selected" : ""}`}><span>{day}</span><small>{litres > 0 ? `${Math.round(litres)} L` : ""}</small></button>;
      })}
    </div>
  </section>;
}

function DailyInspector({ selectedKey, summary, loading, unavailable, drillDown, activeZone, onZone }: { selectedKey: string; summary: DaySummary | undefined; loading: boolean; unavailable: boolean; drillDown: boolean; activeZone: number; onZone(zone: number): void }) {
  const events = summary?.events ?? [];
  const zones = byZone(events);
  return <section className="watering-inspector" aria-labelledby="watering-inspector-title">
    <div className="watering-inspector-heading">
      <div><span className="watering-kicker">Daily Inspector</span><h3 id="watering-inspector-title">{fullDate(selectedKey)}</h3></div>
      <time dateTime={selectedKey}>{displayDate(selectedKey)}</time>
    </div>
    <dl className="watering-day-metrics">
      <div><dt>Water delivered</dt><dd>{loading || unavailable ? "–" : summary?.litres.toFixed(1) ?? "0.0"} <small>L</small></dd></div>
      <div><dt>Waterings</dt><dd>{loading || unavailable ? "–" : summary?.waterings ?? 0}</dd></div>
      <div className={!loading && !unavailable && summary?.issues ? "watering-metric-danger" : ""}><dt>Errors</dt><dd>{loading || unavailable ? "–" : summary?.issues ?? 0}</dd></div>
    </dl>
    {zones.length && !loading && !unavailable ? drillDown
      ? <div className="watering-zone-split proto-c-split">
        {zones.map((zone) => <button type="button" key={zone.zone} aria-pressed={activeZone === zone.zone} onClick={() => onZone(activeZone === zone.zone ? ALL_ZONES : zone.zone)}>
          <span>{zone.label}</span><strong>{zone.litres.toFixed(1)} <small>L</small></strong>
        </button>)}
      </div>
      : <dl className="watering-zone-split">
        {zones.map((zone) => <div key={zone.zone}><dt>{zone.label}</dt><dd>{zone.litres.toFixed(1)} <small>L</small></dd></div>)}
      </dl> : null}
    {loading ? <p className="watering-history-message">Loading daily history…</p>
      : unavailable ? <p className="watering-history-message watering-history-message-error">Watering history unavailable</p>
      : events.length ? <ul className="watering-events-scroll">
        {events.map((event) => <li key={event.id} className={event.outcome === "completed" ? "" : "watering-event-error"}>
          <time dateTime={event.endedAt ?? undefined}>{eventTime(event.endedAt)}</time>
          <span>{eventDuration(event)}</span>
          <strong>{event.litresDelivered.toFixed(1)} L</strong>
          <span>{OUTCOME_LABEL[event.outcome]}</span>
          <span>{event.trigger === "manual" ? "Manual" : "Sequence"} · {zoneLabel(event)}</span>
        </li>)}
      </ul>
      : <p className="watering-history-message">No watering events recorded for this day.</p>}
  </section>;
}

export function Watering({ pumpOn, zoneNames = {} }: { pumpOn: boolean; zoneNames?: Record<number, string> }) {
  const [now, setNow] = useState(() => Date.now());
  const [zoneFilter, setZoneFilter] = useState(ALL_ZONES);
  const [variant, setVariant] = useZoneFilterVariant();
  const todayKey = keyInTimeZone(new Date(now));
  const currentYear = Number(todayKey.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const previousPumpOn = useRef(pumpOn);
  const range = yearRange(year);
  const query = useQuery<WateringHistory>({
    queryKey: ["watering-history", year],
    queryFn: async () => {
      const response = await fetch(`/api/watering-history?since=${encodeURIComponent(range.since)}&until=${encodeURIComponent(range.until)}`);
      if (!response.ok) throw new Error("failed to load watering history");
      const result: unknown = await response.json();
      if (!validHistory(result)) throw new Error("invalid watering history");
      return result;
    },
    refetchInterval: 30_000,
  });

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (previousPumpOn.current && !pumpOn) void query.refetch();
    previousPumpOn.current = pumpOn;
  }, [pumpOn, query.refetch]);

  const history = query.data;
  const allEvents = history?.chartEvents ?? [];
  // PROTOTYPE: scoping keys on the numeric zone, so renaming a zone keeps its
  // history in one place. Labels stay temporal per ADR-0010.
  const stats = useMemo(() => zoneStats(allEvents, zoneNames), [allEvents, zoneNames]);
  const activeStat = stats.find((stat) => stat.zone === zoneFilter);
  const filtered = useMemo(() => allEvents.filter((event) => matchesZone(event, zoneFilter)), [allEvents, zoneFilter]);
  const days = useMemo(() => summarize(filtered), [filtered]);
  const selectedSummary = days.get(selectedKey);
  const initialLoading = query.isPending && !history;
  const unavailable = query.isError && !history;
  const earliestYear = history?.earliestEventAt ? Number(keyInTimeZone(new Date(history.earliestEventAt)).slice(0, 4)) : currentYear;
  const lastValue = pumpOn ? "Watering now" : initialLoading ? "Loading…" : unavailable ? "Unavailable" : elapsed(history?.lastWatering ?? null, now);
  const lastDetail = !pumpOn && history?.lastWatering ? `${history.lastWatering.litresDelivered.toFixed(1)} L · ${OUTCOME_LABEL[history.lastWatering.outcome].toLowerCase()}` : "";
  const changeYear = (nextYear: number) => {
    setYear(nextYear);
    setSelectedKey((current) => clampSelection(nextYear, current, todayKey));
  };

  return <Card className="card-watering watering-history"><CardTitle icon={icon}>Watering history</CardTitle>
    <div className="watering-history-header">
      <div className="watering-last"><span>Last watering</span><strong aria-live="polite">{lastValue}</strong>{lastDetail ? <small>{lastDetail}</small> : null}</div>
      <div className="watering-year-heading"><span className="watering-kicker">Year overview</span><YearControl year={year} currentYear={currentYear} earliestYear={earliestYear} onYear={changeYear}/></div>
    </div>
    {variant === "A" ? <ZoneSegments stats={stats} active={zoneFilter} onChange={setZoneFilter}/> : null}
    {variant === "C" && activeStat ? <ZoneScopeBanner label={activeStat.label} onClear={() => setZoneFilter(ALL_ZONES)}/> : null}
    {variant === "B"
      ? <ZoneStrips year={year} stats={stats} events={allEvents} todayKey={todayKey} selectedZone={zoneFilter} selectedKey={selectedKey} disabled={initialLoading || unavailable} onSelect={(zone, key) => { setZoneFilter(zone); setSelectedKey(key); }}/>
      : <YearHeatmap year={year} selectedKey={selectedKey} todayKey={todayKey} days={days} disabled={initialLoading || unavailable} onSelect={setSelectedKey}/>}
    {query.isError && history ? <p className="watering-refresh-warning" role="status">Refresh failed; showing previous history.</p> : null}
    <div className="watering-history-detail">
      <MonthFocus selectedKey={selectedKey} todayKey={todayKey} days={days} disabled={initialLoading || unavailable} onSelect={setSelectedKey}/>
      <DailyInspector selectedKey={selectedKey} summary={selectedSummary} loading={initialLoading} unavailable={unavailable} drillDown={variant === "C"} activeZone={zoneFilter} onZone={setZoneFilter}/>
    </div>
    <PrototypeSwitcher variants={["A", "B", "C"]} current={variant} names={zoneFilterVariants} onChange={setVariant}/>
  </Card>;
}
