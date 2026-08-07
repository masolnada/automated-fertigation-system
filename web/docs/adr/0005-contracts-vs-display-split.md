# Wire types are shared; display metadata stays client-side

`@hort/contracts` holds only wire-safe types shared by server and browser — the
snapshot, command bodies, reset-result union, and entity **kinds** (needed to
parse topics). Presentation — labels, decimals, units — is deliberately kept out
of contracts and out of the server, living client-side, so the server domain
never carries display concerns and the wire stays serialization-safe (e.g. log
timestamps are ISO strings, converted to `Date` only at the client boundary).
