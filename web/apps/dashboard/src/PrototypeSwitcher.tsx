import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * PROTOTYPE ONLY — delete with the variants once one wins.
 *
 * Floating variant switcher. Deliberately styled unlike the dashboard so it is
 * obviously not part of the design being judged.
 */
export function PrototypeSwitcher({ variants, current, names, onChange }: { variants: string[]; current: string; names: Record<string, string>; onChange(next: string): void }) {
  if (process.env.NODE_ENV === "production") return null;

  const step = (delta: number) => onChange(variants[(variants.indexOf(current) + delta + variants.length) % variants.length]!);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement | null)?.isContentEditable) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current]);

  const button: React.CSSProperties = { width: 34, height: 34, border: "2px solid #fff", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1, borderRadius: 999 };

  // Portalled to the body: it is an overlay, not part of any card's layout, so
  // it must not appear inside the tree under test.
  return createPortal(<div style={{ position: "fixed", zIndex: 50, bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", background: "#111", color: "#fff", borderRadius: 999, boxShadow: "0 6px 24px rgba(0,0,0,0.35)", fontFamily: "system-ui, sans-serif" }}>
    <button style={button} onClick={() => step(-1)} aria-label="Previous variant">←</button>
    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 230, textAlign: "center" }}>{current} — {names[current]}</span>
    <button style={button} onClick={() => step(1)} aria-label="Next variant">→</button>
  </div>, document.body);
}
