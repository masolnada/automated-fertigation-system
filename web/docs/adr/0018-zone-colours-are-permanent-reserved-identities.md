> **Superseded by [ADR-0019](0019-zone-colours-are-a-client-side-aid.md).** Colour
> is now a disposable, browser-local aid with no server involvement.

# Zone colours are permanent reserved identities

A Zone chooses one of eight named colour keys when it is created. The server stores that key, enforces uniqueness across both live and archived Zones, and never permits editing or releases the key on archive; this trades finite palette exhaustion for one stable visual identity across current views, history and restoration.

UUID-derived colours were rejected because they give the operator no choice and cannot guarantee distinction. Reusing archived colours was rejected because one marker could then mean two places in history and restoration would need conflict resolution. Existing Zones receive keys in creation order during migration, and creation is blocked once every key is reserved.

Because the key is durable identity but its rendered hue is presentation, the palette can be revised without touching Zone records. The first set sat in a single blue-to-magenta arc and read as near-identical; it was replaced with eight keys spread around the hue wheel (Terracotta, Ochre, Olive, Teal, Petrol, Indigo, Purple, Magenta). Migration `0005` remaps each stored key onto the new set by position, so live Zones simply re-tint. Spreading the wheel brings the earth tones close to the `warning` amber and the teal close to the `water` cyan; this is accepted because a Zone tint is always a fill behind the Zone name and never the sole state signal.
