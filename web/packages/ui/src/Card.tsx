import type { HTMLAttributes, ReactNode } from "react"; import { variants } from "./theme/variants";
export function Card({ children, className = "", ...props }: HTMLAttributes<HTMLElement>) { return <section className={`${variants.card} ${className}`} {...props}>{children}</section>; }
export function CardTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) { return <h2 className={variants.title}><span className={variants.icon} aria-hidden="true">{icon}</span>{children}</h2>; }
