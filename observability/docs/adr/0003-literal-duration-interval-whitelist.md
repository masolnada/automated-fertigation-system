# The bar-chart interval is a literal-duration whitelist, not a parsed variable

The usage bucket width is resolved from a fixed whitelist (`15m`, `1h`, `6h`,
`1d`, `7d`) with a `1h` fallback, rather than parsing the Grafana template
variable at query time with `duration()`. A bookmarked or stale value such as
`Auto` would otherwise break the Flux query; the whitelist makes an unknown value
degrade to a sane default instead of failing.
