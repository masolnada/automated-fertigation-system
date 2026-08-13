import { useTheme } from "./theme/useTheme";
import { variants } from "./theme/variants";

const sun = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
const moon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>;

/**
 * Switches the substrate. Instantly reversible and nothing is lost, so it is
 * not a Confirmation; it sits beside the connection strip because, like it, it
 * applies to the whole page.
 */
export function ThemeToggle() {
  const [mode, choose] = useTheme();
  const next = mode === "dark" ? "light" : "dark";

  return <button type="button" className={variants.themeToggle} aria-pressed={mode === "dark"} title={`Switch to ${next} mode`} aria-label={`Switch to ${next} mode`} onClick={() => choose(next)}>
    {mode === "dark" ? moon : sun}
  </button>;
}
