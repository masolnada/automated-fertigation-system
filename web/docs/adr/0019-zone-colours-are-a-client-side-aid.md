# Zone colours are a disposable client-side aid

A Zone's colour is a browser-local presentational aid, not a server-owned
identity: the operator picks any palette colour per Zone from the Zones list, the
choice is kept only in `localStorage` (like the theme, web ADR-0013), colours may
repeat freely, and an archived Zone has no colour and renders gray. Nothing about
colour reaches the server — no column, no contract field, no uniqueness.

This supersedes ADR-0018, which made colour a permanent, unique, reserved,
server-persisted identity. That model bought cross-device and historical
consistency at the cost of real machinery (a unique column, transactional
conflict handling, a fixed palette exhaustion, migrations) for something the
operator considers a mere visual aid. Choosing "disposable and simple" trades
that consistency away: colours differ per browser, are lost on archive, and are
not guaranteed distinct. The unused `colour` column is dropped by migration 0006.
