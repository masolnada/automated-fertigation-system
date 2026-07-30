import { forwardRef } from "react"; import type { ButtonHTMLAttributes } from "react"; import { variants } from "./theme/variants";
type Variant = "default" | "primary" | "danger" | "relay";
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(function Button({ variant = "default", className = "", ...props }, ref) { return <button ref={ref} className={`${variants.button[variant]} ${className}`} {...props} />; });
