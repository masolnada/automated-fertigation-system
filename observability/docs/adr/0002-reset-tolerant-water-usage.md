# Water is shown as per-period usage from a non-negative difference, not a cumulative line

The main water panel is a bar chart of consumption per interval, computed as
`difference(nonNegative: true)` over the monotonic Total Water counter and
zero-filled, and the same non-negative-difference basis feeds the range total.
This replaced a cumulative time-series because usage-per-period answers the real
question and, crucially, is reset-tolerant: an irreversible Total Water reset
drops the counter to zero and would otherwise render as a huge negative spike.
