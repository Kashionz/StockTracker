import { describe, expect, it } from "vitest";
import {
  INTRADAY_INTERVAL_MS,
  OFFHOURS_INTERVAL_MS,
  getRefreshIntervalMs,
  isMarketOpen,
  isTwSessionOpen,
  isUsSessionOpen
} from "./marketHours";

describe("marketHours", () => {
  it("treats a weekday Taiwan morning as a TW trading session", () => {
    // 2026-06-08T02:00:00Z -> Taipei 10:00 (Mon)
    const date = new Date("2026-06-08T02:00:00Z");

    expect(isTwSessionOpen(date)).toBe(true);
    expect(isMarketOpen(date)).toBe(true);
  });

  it("treats the Taiwan afternoon after 13:30 as closed", () => {
    // 2026-06-08T06:00:00Z -> Taipei 14:00 (Mon); New York 02:00 EDT (closed)
    const date = new Date("2026-06-08T06:00:00Z");

    expect(isTwSessionOpen(date)).toBe(false);
    expect(isUsSessionOpen(date)).toBe(false);
    expect(isMarketOpen(date)).toBe(false);
  });

  it("treats a weekday New York mid-session (summer EDT) as a US trading session", () => {
    // 2026-06-08T15:00:00Z -> New York 11:00 EDT (Mon); Taipei 23:00 (TW closed)
    const date = new Date("2026-06-08T15:00:00Z");

    expect(isTwSessionOpen(date)).toBe(false);
    expect(isUsSessionOpen(date)).toBe(true);
    expect(isMarketOpen(date)).toBe(true);
  });

  it("honors US standard time (EST) when detecting a winter session", () => {
    // 2026-01-05T18:00:00Z -> New York 13:00 EST (Mon)
    const date = new Date("2026-01-05T18:00:00Z");

    expect(isUsSessionOpen(date)).toBe(true);
  });

  it("uses real US Eastern time rather than a fixed offset (EST before the open)", () => {
    // 2026-01-05T14:00:00Z -> New York 09:00 EST (before 09:30 open).
    // A naive fixed UTC-4 assumption would wrongly read 10:00 and report open.
    const date = new Date("2026-01-05T14:00:00Z");

    expect(isUsSessionOpen(date)).toBe(false);
    expect(isMarketOpen(date)).toBe(false);
  });

  it("treats the weekend as closed in both markets", () => {
    // 2026-06-06 is a Saturday
    const date = new Date("2026-06-06T05:00:00Z");

    expect(isTwSessionOpen(date)).toBe(false);
    expect(isUsSessionOpen(date)).toBe(false);
    expect(isMarketOpen(date)).toBe(false);
  });

  it("refreshes every minute while a market is open and every 15 minutes otherwise", () => {
    const open = new Date("2026-06-08T02:00:00Z");
    const closed = new Date("2026-06-08T06:00:00Z");

    expect(getRefreshIntervalMs(open)).toBe(INTRADAY_INTERVAL_MS);
    expect(getRefreshIntervalMs(open)).toBe(60_000);
    expect(getRefreshIntervalMs(closed)).toBe(OFFHOURS_INTERVAL_MS);
    expect(getRefreshIntervalMs(closed)).toBe(900_000);
  });
});
