import { useQuery } from "@tanstack/react-query";
import { Card, CardTitle } from "@hort/ui";
import type { WateringEvent } from "@hort/contracts";

const icon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/><path d="M12 8v8"/><path d="M8.5 12.5 12 16l3.5-3.5"/></svg>;

function duration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "in progress";
  const seconds = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

export function Watering() {
  const { data } = useQuery<WateringEvent[]>({
    queryKey: ["watering-events"],
    queryFn: async () => { const response = await fetch("/api/watering-events"); if (!response.ok) throw new Error("failed to load watering events"); return response.json(); },
    refetchInterval: 30_000,
  });
  const events = Array.isArray(data) ? data : [];
  return <Card className="card-watering"><CardTitle icon={icon}>Watering history</CardTitle>
    <ul className="list-none m-0 p-0 text-[0.9rem] max-h-72 overflow-y-auto empty:after:content-['No_waterings_recorded_yet.'] empty:after:block empty:after:py-2 empty:after:italic">
      {events.map((event) => <li key={event.id} className="flex items-baseline gap-4 py-[0.5rem] border-b-[2px] border-dashed border-gray last:border-b-0">
        <time className="font-num tabular-nums font-extrabold">{new Date(event.startedAt).toLocaleString()}</time>
        <span className="font-bold uppercase text-[0.72rem] tracking-[0.06em]">{duration(event.startedAt, event.endedAt)}</span>
        <span className="font-num font-extrabold text-[1.1rem] ml-auto">{event.litresDelivered === null ? "–" : event.litresDelivered.toFixed(1)}<i className="not-italic text-[0.72rem] font-extrabold ml-[0.35rem]">L</i></span>
      </li>)}
    </ul></Card>;
}
