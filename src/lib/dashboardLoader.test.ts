import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDashboardPayload } from "../data/mockPayload";
import type { DashboardPayload } from "../types";
import {
  loadDashboardSnapshot,
  resetDashboardSnapshotCache
} from "./dashboardLoader";

describe("dashboardLoader", () => {
  beforeEach(() => {
    resetDashboardSnapshotCache();
  });

  it("falls back to mock data when live source is unavailable", async () => {
    const snapshot = await loadDashboardSnapshot({
      loadLivePayload: async () => {
        throw new Error("network unavailable");
      }
    });

    expect(snapshot.lastUpdatedAt).toBe(mockDashboardPayload.lastUpdatedAt);
    expect(snapshot.watchSections[0].items[0].symbol).toBe("NVDA");
  });

  it("normalizes live payload when provider returns data", async () => {
    const livePayload: DashboardPayload = {
      ...mockDashboardPayload,
      lastUpdatedAt: "2026-06-07T10:05:00+08:00",
      quotes: mockDashboardPayload.quotes.map((quote) =>
        quote.symbol === "NVDA" ? { ...quote, price: 934.2, changePct: 4.1 } : quote
      )
    };

    const loadLivePayload = vi.fn().mockResolvedValue(livePayload);
    const snapshot = await loadDashboardSnapshot({ loadLivePayload });

    expect(loadLivePayload).toHaveBeenCalledOnce();
    expect(snapshot.lastUpdatedAt).toBe("2026-06-07T10:05:00+08:00");
    expect(snapshot.watchSections[0].items[0]).toMatchObject({
      symbol: "NVDA",
      price: 934.2,
      trend: "up"
    });
  });

  it("reuses the cached snapshot within ttl to avoid duplicate fetches", async () => {
    const loadLivePayload = vi.fn().mockResolvedValue({
      ...mockDashboardPayload,
      lastUpdatedAt: "2026-06-07T10:05:00+08:00"
    } satisfies DashboardPayload);

    const firstSnapshot = await loadDashboardSnapshot({
      loadLivePayload,
      cacheTtlMs: 60_000,
      now: () => 1_000
    });
    const secondSnapshot = await loadDashboardSnapshot({
      loadLivePayload,
      cacheTtlMs: 60_000,
      now: () => 20_000
    });

    expect(loadLivePayload).toHaveBeenCalledOnce();
    expect(secondSnapshot).toBe(firstSnapshot);
  });

  it("bypasses cache when force refresh is requested", async () => {
    const firstPayload: DashboardPayload = {
      ...mockDashboardPayload,
      lastUpdatedAt: "2026-06-07T10:05:00+08:00"
    };
    const secondPayload: DashboardPayload = {
      ...mockDashboardPayload,
      lastUpdatedAt: "2026-06-07T10:08:00+08:00"
    };

    const loadLivePayload = vi
      .fn()
      .mockResolvedValueOnce(firstPayload)
      .mockResolvedValueOnce(secondPayload);

    const cachedSnapshot = await loadDashboardSnapshot({
      loadLivePayload,
      cacheTtlMs: 60_000,
      now: () => 1_000
    });
    const refreshedSnapshot = await loadDashboardSnapshot({
      loadLivePayload,
      force: true,
      cacheTtlMs: 60_000,
      now: () => 2_000
    });

    expect(loadLivePayload).toHaveBeenCalledTimes(2);
    expect(cachedSnapshot.lastUpdatedAt).toBe("2026-06-07T10:05:00+08:00");
    expect(refreshedSnapshot.lastUpdatedAt).toBe("2026-06-07T10:08:00+08:00");
  });
});
