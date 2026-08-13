import { useEffect, useId, useRef, useState } from "react";
import { variants } from "../theme/variants";
import { useMediaQuery } from "../useMediaQuery";
import { Modal } from "../Modal/Modal";

export type SelectOption = { value: string; label: string };

/** Below this the dropdown panel gives way to a centred sheet with thumb-sized rows. */
export const SELECT_SHEET_MAX_WIDTH = 640;

type Props = {
  /** Names the control for assistive technology, and titles the sheet on a phone. */
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
 * acting on the system, so it must not compete with the data it filters.
 *
 * On a phone the options open as a centred sheet instead of a dropdown. A panel
 * hanging off a control near the top of the card puts its rows under the hand
 * that opened it and at whatever size the trigger's type implies; the sheet
 * centres them and gives each a full tap target. It is the same listbox either
 * way — only the container and the row size change.
 *
 * Follows the ARIA listbox pattern. Focus stays on the trigger and
 * `aria-activedescendant` names the highlighted option, so the selected value
 * and the keyboard cursor stay distinguishable. Both are marked by ink fill and
 * outline rather than colour alone (DESIGN.md §1).
 */
export function Select({ label, value, options, onChange, className = "" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const sheet = useMediaQuery(`(max-width: ${SELECT_SHEET_MAX_WIDTH}px)`);
  const selected = Math.max(0, options.findIndex((option) => option.value === value));
  const [active, setActive] = useState(selected);
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const s = variants.select;

  // The sheet is a modal dialog, so the platform already dismisses on Escape and
  // blocks everything outside it; this is only the dropdown's outside click.
  useEffect(() => {
    if (!open || sheet) return;
    const onPointerDown = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, sheet]);

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

  const listbox = <ul
    ref={list}
    id={`${id}-list`}
    className={sheet ? s.sheetList : s.panel}
    role="listbox"
    aria-label={label}
    aria-activedescendant={`${id}-option-${active}`}
    tabIndex={sheet ? 0 : undefined}
    onKeyDown={sheet ? onKeyDown : undefined}
  >
    {options.map((option, index) => <li
      key={option.value}
      id={`${id}-option-${index}`}
      role="option"
      aria-selected={index === selected}
      className={`${sheet ? s.sheetOption : s.option} ${index === selected ? s.optionOn : s.optionOff}${index === active ? ` ${s.optionActive}` : ""}`}
      onPointerEnter={() => setActive(index)}
      onClick={() => commit(index)}
    >{option.label}</li>)}
  </ul>;

  return <span ref={wrap} className={`${s.wrap} ${className}`}>
    <button
      ref={trigger}
      type="button"
      className={s.trigger}
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open && !sheet ? `${id}-option-${active}` : undefined}
      onClick={() => (open ? close() : reveal())}
      onKeyDown={onKeyDown}
    >
      <span className={s.value}>{options[selected]?.label ?? ""}</span>
      <span className={s.caret} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
    </button>
    {open && sheet ? <Modal open labelledBy={`${id}-title`} onDismiss={close}>
      <h2 id={`${id}-title`} className={s.sheetTitle}>{label}</h2>
      {listbox}
    </Modal> : null}
    {open && !sheet ? listbox : null}
  </span>;
}
