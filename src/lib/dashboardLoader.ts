import { mockDashboardPayload } from "../data/mockPayload";
import type { DashboardPayload, DashboardSnapshot } from "../types";
import { loadLiveDashboardPayload } from "./api";
import { buildDashboardSnapshot } from "./marketTransformer";

export interface DashboardLoaderOptions {
  loadLivePayload?: () => Promise<DashboardPayload | null>;
  force?: boolean;
  cacheTtlMs?: number;
  now?: () => number;
}

const defaultCacheTtlMs = 1000 * 45;

let cachedSnapshot: DashboardSnapshot | null = null;
let cachedAt = 0;

export function resetDashboardSnapshotCache() {
  cachedSnapshot = null;
  cachedAt = 0;
}

export async function loadDashboardSnapshot(
  options: DashboardLoaderOptions = {}
): Promise<DashboardSnapshot> {
  const loadLivePayload = options.loadLivePayload ?? loadLiveDashboardPayload;
  const force = options.force ?? false;
  const cacheTtlMs = options.cacheTtlMs ?? defaultCacheTtlMs;
  const now = options.now ?? Date.now;

  if (!force && cachedSnapshot && now() - cachedAt < cacheTtlMs) {
    return cachedSnapshot;
  }

  try {
    const livePayload = await loadLivePayload();

    if (livePayload) {
      const liveSnapshot = buildDashboardSnapshot(livePayload, "live");

      cachedSnapshot = liveSnapshot;
      cachedAt = now();

      return liveSnapshot;
    }
  } catch {
    // Swallow provider failures and keep the dashboard usable via mock data.
  }

  const mockSnapshot = buildDashboardSnapshot(mockDashboardPayload, "mock");

  cachedSnapshot = mockSnapshot;
  cachedAt = now();

  return mockSnapshot;
}
