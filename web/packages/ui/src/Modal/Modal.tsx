import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { variants } from "../theme/variants";

type Props = { open: boolean; labelledBy: string; describedBy?: string; dismissible?: boolean; wide?: boolean; onDismiss(): void; children: ReactNode };

/**
 * The native dialog in its modal state (web ADR-0012): the top layer puts it
 * above the page whatever the ancestors do, and the platform supplies the focus
 * trap, background inertness and focus restore that a div would have to fake.
 * `dismissible` false suppresses both dismissal routes at once — Escape reaches
 * us as `cancel`, and a click landing on the dialog itself rather than on its
 * panel is a backdrop click.
 *
 * `wide` is for a surface that is building something rather than asking a
 * question: a multi-step form needs room to lay its steps out side by side,
 * where a Confirmation wants to stay small enough to read in one glance.
 */
export function Modal({ open, labelledBy, describedBy, dismissible = true, wide = false, onDismiss, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog
    ref={ref}
    className={wide ? variants.dialog.backdropWide : variants.dialog.backdrop}
    aria-labelledby={labelledBy}
    aria-describedby={describedBy}
    onCancel={(event) => { event.preventDefault(); if (dismissible) onDismiss(); }}
    onMouseDown={(event) => { if (dismissible && event.target === event.currentTarget) onDismiss(); }}
  >
    <section className={variants.dialog.panel}>{children}</section>
  </dialog>;
}
