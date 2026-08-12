import { variants } from "./theme/variants";

export type SelectOption = { value: string; label: string };

/**
 * A hairline select: an underline and a caret, no box.
 *
 * Deliberately quieter than Button. It scopes what a surface shows rather than
 * acting on the system, so it must not compete with the data it filters — which
 * is why it carries no border box and sits at caption weight.
 *
 * The native control is kept, so the option list, keyboard behaviour and mobile
 * picker come from the OS. `appearance-none` strips its rounded grey chrome and
 * the caret is drawn as a stroke icon to stay on-palette (DESIGN.md §4).
 */
export function Select({ label, value, options, onChange, className = "" }: { label: string; value: string; options: readonly SelectOption[]; onChange(value: string): void; className?: string }) {
  const s = variants.select;
  return <span className={`${s.wrap} ${className}`}>
    <select className={s.field} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <span className={s.caret} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
  </span>;
}
