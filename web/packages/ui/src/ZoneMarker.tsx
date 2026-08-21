import { zoneTintStyle, type ZoneColour } from "./theme/zoneColour";

/**
 * The small square that identifies a Zone wherever it is named. Decorative for
 * assistive technology because the adjacent Zone name remains authoritative.
 */
export function ZoneMarker({ colour, className = "" }: { colour: ZoneColour; className?: string }) {
  return <span className={`zone-tint zone-marker ${className}`} style={zoneTintStyle(colour)} data-zone-colour={colour} aria-hidden="true"/>;
}
