import { describe, expect, it } from "vitest";
import { mockDashboardPayload } from "../data/mockPayload";
import {
  buildDashboardSnapshot,
  buildImpactTargets,
  inferSentiment
} from "./marketTransformer";

describe("marketTransformer", () => {
  it("normalizes macro, watchlist, and news data into dashboard sections", () => {
    const snapshot = buildDashboardSnapshot(mockDashboardPayload);

    expect(snapshot.marketStrip).toHaveLength(7);
    expect(snapshot.watchSections).toHaveLength(3);
    expect(snapshot.watchSections[0].label).toBe("美股科技權值");
    expect(snapshot.watchSections[1].items[0]).toMatchObject({
      symbol: "2330",
      name: "台積電",
      trend: "up",
      delayTag: "盤後"
    });
    expect(snapshot.newsFeed[0]).toMatchObject({
      sentiment: "bullish",
      affectedSymbols: expect.arrayContaining(["NVDA", "2330", "2382", "3231"])
    });
    expect(snapshot.dailyBrief).toMatchObject({
      sessionLabel: "台股盤中追蹤"
    });
    expect(snapshot.dailyBrief.bullets.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.dailyBrief.focusSymbols).toEqual(
      expect.arrayContaining(["NVDA", "2330"])
    );
    expect(snapshot.lastUpdatedAt).toBe("2026-06-07T09:32:00+08:00");
  });

  it("infers sentiment from score or neutral language fallback", () => {
    expect(
      inferSentiment({
        title: "NVIDIA earnings beat expectations",
        summary: "Demand for AI servers remained strong.",
        sentimentScore: 0.51
      })
    ).toBe("bullish");

    expect(
      inferSentiment({
        title: "聯準會官員發表談話",
        summary: "市場觀望後續政策路徑，資金態度偏保守。",
        sentimentScore: null
      })
    ).toBe("neutral");

    expect(
      inferSentiment({
        title: "Export controls tighten on AI chips",
        summary: "Restrictions may slow shipments into key markets.",
        sentimentScore: -0.44
      })
    ).toBe("bearish");
  });

  it("expands affected symbols through supply-chain relationships", () => {
    const affectedSymbols = buildImpactTargets(
      {
        id: "news-nvda",
        title: "NVDA raises AI demand outlook",
        summary: "Cloud customers continue to accelerate GPU orders.",
        source: "Reuters",
        publishedAt: "2026-06-07T09:15:00+08:00",
        sentimentScore: 0.67,
        symbols: ["NVDA"]
      },
      mockDashboardPayload.relationships
    );

    expect(affectedSymbols).toEqual(
      expect.arrayContaining(["NVDA", "2330", "2382", "3231", "2308"])
    );
    expect(new Set(affectedSymbols).size).toBe(affectedSymbols.length);
  });

  it("sorts news by actual timestamp when mixed ISO offsets are present", () => {
    const payload = {
      ...mockDashboardPayload,
      news: [
        {
          id: "news-local-offset",
          title: "較早的台北時間新聞",
          summary: "offset time",
          source: "Test",
          publishedAt: "2026-06-08T08:10:00+08:00",
          sentimentScore: null,
          symbols: ["2330"]
        },
        {
          id: "news-utc-z",
          title: "較新的 UTC 新聞",
          summary: "utc time",
          source: "Test",
          publishedAt: "2026-06-08T01:00:00.000Z",
          sentimentScore: null,
          symbols: ["NVDA"]
        }
      ]
    };

    const snapshot = buildDashboardSnapshot(payload);

    expect(snapshot.newsFeed[0].id).toBe("news-utc-z");
    expect(snapshot.newsFeed[1].id).toBe("news-local-offset");
  });
});
