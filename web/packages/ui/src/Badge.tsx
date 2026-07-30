import { variants } from "./theme/variants";
export function Badge({ state = "off", children, hidden = false }: { state?: "on" | "off" | "online" | "offline"; children: React.ReactNode; hidden?: boolean }) { return <span className={`${variants.badge.base} ${variants.badge[state]}${hidden ? ` ${variants.badge.hidden}` : ""}`}>{children}</span>; }
