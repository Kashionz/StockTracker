// Refresh cadence: fast while a market is open, slow otherwise.
export const INTRADAY_INTERVAL_MS = 60_000;
export const OFFHOURS_INTERVAL_MS = 900_000;

// Regular trading sessions in each exchange's local time, as minutes of day.
const TW_SESSION = { open: 9 * 60, close: 13 * 60 + 30 }; // 09:00–13:30 Asia/Taipei
const US_SESSION = { open: 9 * 60 + 30, close: 16 * 60 }; // 09:30–16:00 America/New_York

const WEEKEND = new Set(["Sat", "Sun"]);

interface ZonedParts {
  weekday: string;
  minutesOfDay: number;
}

// Reads the wall-clock weekday + time in the given IANA time zone. Using Intl
// keeps US DST (EST/EDT) correct without hardcoding offsets.
function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const lookup: Record<string, string> = {};

  for (const part of parts) {
    lookup[part.type] = part.value;
  }

  return {
    weekday: lookup.weekday,
    minutesOfDay: Number(lookup.hour) * 60 + Number(lookup.minute)
  };
}

function isWithinSession(
  parts: ZonedParts,
  session: { open: number; close: number }
): boolean {
  if (WEEKEND.has(parts.weekday)) {
    return false;
  }

  return parts.minutesOfDay >= session.open && parts.minutesOfDay < session.close;
}

export function isTwSessionOpen(date: Date): boolean {
  return isWithinSession(getZonedParts(date, "Asia/Taipei"), TW_SESSION);
}

export function isUsSessionOpen(date: Date): boolean {
  return isWithinSession(getZonedParts(date, "America/New_York"), US_SESSION);
}

export function isMarketOpen(date: Date): boolean {
  return isTwSessionOpen(date) || isUsSessionOpen(date);
}

export function getRefreshIntervalMs(date: Date): number {
  return isMarketOpen(date) ? INTRADAY_INTERVAL_MS : OFFHOURS_INTERVAL_MS;
}
