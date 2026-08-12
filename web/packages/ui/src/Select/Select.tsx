import { useEffect, useId, useRef, useState } from "react";
import { variants } from "../theme/variants";

export type SelectOption = { value: string; label: string };

type Props = {
  /** Names the control for assistive technology. */
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange(value: string): void;
  className?: string;
};

/**
 * A hairline select: an underline and a caret, no box.
 *
 * Built as a listbox rather than a native `<select>` because the browser owns
 * the native option list and paints it with rounded corners, shadows and system
 * colours that no stylesheet can reach — the paper surface would break open.
 *
 * Deliberately quieter than Button: it scopes what a surface shows rather than
 * acting on the system, so it must not compete with the data it filters. The
 * panel is absolutely positioned, so opening it shifts no layout (DESIGN.md §3).
 *
 * Follows the ARIA listbox pattern. Focus stays on the trigger and
 * `aria-activedescendant` names the highlighted option, so the selected value
 * and the keyboard cursor stay distinguishable. Both are marked by ink fill and
 * outline rather than colour alone (DESIGN.md §1).
 */
export function Select({ label, value, options, onChange, className = "" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = Math.max(0, options.findIndex((option) => option.value === value));
  const [active, setActive] = useState(selected);
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const s = variants.select;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keeps the highlighted option visible once the list is long enough to scroll.
  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const close = () => { setOpen(false); trigger.current?.focus(); };
  const commit = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  };
  const reveal = () => { setActive(selected); setOpen(true); };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = (delta: number) => { event.preventDefault(); setActive((current) => Math.min(options.length - 1, Math.max(0, current + delta))); };
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") { event.preventDefault(); reveal(); }
      return;
    }
    if (event.key === "ArrowDown") return step(1);
    if (event.key === "ArrowUp") return step(-1);
    if (event.key === "Home") { event.preventDefault(); return setActive(0); }
    if (event.key === "End") { event.preventDefault(); return setActive(options.length - 1); }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); return commit(active); }
    if (event.key === "Escape") { event.preventDefault(); return close(); }
    if (event.key === "Tab") setOpen(false);
  };

  return <span ref={wrap} className={`${s.wrap} ${className}`}>
    <button
      ref={trigger}
      type="button"
      className={s.trigger}
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      onClick={() => (open ? close() : reveal())}
      onKeyDown={onKeyDown}
    >
      <span className={s.value}>{options[selected]?.label ?? ""}</span>
      <span className={s.caret} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
    </button>
    {open ? <ul ref={list} id={`${id}-list`} className={s.panel} role="listbox" aria-label={label}>
      {options.map((option, index) => <li
        key={option.value}
        id={`${id}-option-${index}`}
        role="option"
        aria-selected={index === selected}
        className={`${s.option} ${index === selected ? s.optionOn : s.optionOff}${index === active ? ` ${s.optionActive}` : ""}`}
        onPointerEnter={() => setActive(index)}
        onClick={() => commit(index)}
      >{option.label}</li>)}
    </ul> : null}
  </span>;
}
