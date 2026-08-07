# The e-ink design system is a hard constraint

The dashboard targets a low-refresh e-ink panel, so [`packages/ui/DESIGN.md`](../../packages/ui/DESIGN.md)
is the binding source of truth: strict monochrome, no animation or transitions,
sharp corners, no shadows or gradients, no layout shift. Tailwind's defaults
contradict all of these, so the theme overrides them globally and behaviour is
driven through a variant map plus `@theme` tokens rather than inherited utilities.
A second theme is a new variant map + token file with no behavioural rewrite.
