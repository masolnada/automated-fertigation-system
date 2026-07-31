import { useEffect, useRef } from "react";
import { variants } from "./theme/variants";

type Phase = { id: string; name: string; value?: number; unit: "min" | "L" };
export function PhaseBar({ phases, prewetPercent, onPrewetPercentChange }: { phases: Phase[]; prewetPercent?: number; onPrewetPercentChange?(value: number): void }) {
  const slider = useRef<HTMLInputElement>(null);
  useEffect(() => { if (slider.current && document.activeElement !== slider.current) slider.current.value = String(prewetPercent ?? 0); }, [prewetPercent]);
  const publish = () => { const value = Number(slider.current?.value); if (Number.isFinite(value)) onPrewetPercentChange?.(Math.round(value / 5) * 5); };
  return <div className={variants.phases} title="Irrigation sequence phases">
    {phases.map((phase, index) => {
      const value = Number.isFinite(phase.value) ? phase.value : undefined;
      const isFertigation = phase.id.includes("fertigation");
      const isFlush = phase.id.includes("flush");
      return <div key={phase.id} className={`${variants.phase.base} ${isFertigation ? variants.phase.fertigation : variants.phase.normal}${isFlush ? ` ${variants.phase.flush}` : ""}`} style={{ flexGrow: isFlush ? undefined : Math.max(index === 0 ? (prewetPercent ?? 0) : 100 - (prewetPercent ?? 0), 5) }} title={value === undefined ? undefined : `${phase.name} — ${value} ${phase.unit}`}>
        <span className={variants.phase.label}>{phase.name}</span><b className={variants.phase.value}>{value === undefined ? "–" : value}<small>{phase.unit}</small></b>
        {index === 0 && onPrewetPercentChange && <input ref={slider} className={variants.phase.slider} aria-label="Pre-wet Percent" type="range" min="0" max="100" step="5" defaultValue={prewetPercent ?? 0} onPointerUp={publish} onKeyUp={publish} />}
      </div>;
    })}
  </div>;
}
