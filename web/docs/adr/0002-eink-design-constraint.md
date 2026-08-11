# The paper design system is a hard constraint

Superseded in scope by ADR-0011: the constraints below are now an aesthetic
choice, not a hardware one. The document remains binding.

The dashboard uses a deliberately minimal, paper-like visual language, so
[`packages/ui/DESIGN.md`](../../packages/ui/DESIGN.md) is the binding source of
truth: restrained palette, flat surfaces, sharp corners, no shadows or gradients,
no layout shift, and no motion except where movement itself carries information.
Tailwind's defaults contradict all of these, so the theme overrides them globally
and behaviour is driven through a variant map plus `@theme` tokens rather than
inherited utilities. A second theme is a new variant map + token file with no
behavioural rewrite.
