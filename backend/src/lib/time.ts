// ═══════════════════════════════════════════════════════════════════════════════
// Eastern Time Utilities
// ═══════════════════════════════════════════════════════════════════════════════
//
// All user-facing times are displayed in Eastern Time (ET) since
// Stony Brook University is in New York.

const TIMEZONE = "America/New_York";

/** Full format: "Friday, April 10, 2026 at 4:00 PM ET" */
export function toEastern(isoString: string): string {
  return (
    new Date(isoString).toLocaleString("en-US", {
      timeZone: TIMEZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " ET"
  );
}

/** Short format: "Fri, Apr 10, 4:00 PM ET" */
export function toEasternShort(isoString: string): string {
  return (
    new Date(isoString).toLocaleString("en-US", {
      timeZone: TIMEZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " ET"
  );
}

/** Returns today's date in Eastern as "Friday, April 10, 2026" */
export function todayEastern(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
