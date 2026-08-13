import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "hort-theme";

/**
 * The chosen substrate, persisted per browser (web ADR-0013).
 *
 * The mode is read back from the attribute rather than recomputed, because the
 * inline boot script in `index.html` is its sole author for the first paint —
 * deciding it twice invites the two to disagree. `prefers-color-scheme` seeds
 * only that first paint and is never consulted again, so the toggle is the only
 * authority once it has been used.
 */
export function useTheme(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(() => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"));

  const choose = useCallback((next: ThemeMode) => {
    setMode(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* private mode: the choice lasts this session only */ }
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = mode; }, [mode]);

  return [mode, choose];
}
