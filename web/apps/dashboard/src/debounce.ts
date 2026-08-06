import { useCallback, useEffect, useRef } from "react";
/** Debounce a callback; trailing edge, cleared on unmount. Used to throttle number-input keystrokes into one HTTP command. */
export function useDebounced<A extends unknown[]>(fn: (...args: A) => void, ms = 350): (...args: A) => void {
  const latest = useRef(fn); latest.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback((...args: A) => { clearTimeout(timer.current); timer.current = setTimeout(() => latest.current(...args), ms); }, [ms]);
}
