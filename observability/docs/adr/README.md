# Architecture Decision Records — Observability

Decisions for metrics and history (`observability/`). Each record is one decision
in 1–3 sentences. See [../../CONTEXT.md](../../CONTEXT.md) for the glossary.

| # | Decision |
|---|---|
| [0001](0001-source-of-truth-in-repo.md) | Config is versioned here and deployed to the homelab via `just deploy` |
| [0002](0002-reset-tolerant-water-usage.md) | Water is per-period usage from a non-negative difference, reset-tolerant |
| [0003](0003-literal-duration-interval-whitelist.md) | The bar-chart interval is a literal-duration whitelist |
