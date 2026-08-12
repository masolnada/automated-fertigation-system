import { cloneElement, useEffect, useId, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { variants } from "../theme/variants";

export type HoverDialogPlacement = "top" | "bottom" | "right";

type Props = {
  /** Rendered inside the dialog. */
  content: ReactNode;
  placement?: HoverDialogPlacement;
  /** The dialog is only reachable while this is true. */
  enabled?: boolean;
  /** The trigger. Receives `aria-describedby` while the dialog is open. */
  children: ReactElement;
  className?: string;
};

/**
 * A dialog revealed by pointing at or focusing its trigger.
 *
 * Keyboard focus opens it as well as hover, so the content is not
 * pointer-only, and Escape dismisses it. It is absolutely positioned so
 * appearing shifts no layout (DESIGN.md §3).
 *
 * It is supplementary by construction: a device with no pointer never opens
 * it, so nothing may live in here that the operator cannot also learn from the
 * surface underneath.
 */
export function HoverDialog({ content, placement = "top", enabled = true, children, className = "" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const shown = enabled && open;

  useEffect(() => {
    if (!shown) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shown]);

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, { "aria-describedby": shown ? id : undefined });
  const s = variants.hoverDialog;

  // focus/blur are used rather than focusin/focusout listeners because React
  // delegates them and they bubble from the trigger to this wrapper.
  return <span
    className={`relative inline-flex ${className}`}
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => setOpen(false)}
    onFocus={() => setOpen(true)}
    onBlur={() => setOpen(false)}
  >
    {trigger}
    {shown ? <span role="tooltip" id={id} className={`${s.base} ${s[placement]}`}>{content}</span> : null}
  </span>;
}
