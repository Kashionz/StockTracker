import { describe, expect, it } from "vitest";
import type { DailyBrief } from "../types";
import { composeDailyBriefText } from "./briefComposer";

const brief: DailyBrief = {
  sessionLabel: "台股盤前摘要",
  headline: "NVIDIA 財測上修，AI 伺服器需求持續強勁",
  bullets: [
    "TAIEX 目前 -1.33%，數值來到 45,070.94。",
    "強弱分化以 2303 +5.20% 與 2308 -5.15% 最具代表性。",
    "消息面統計為利多 3 則、利空 0 則、中性 1 則。"
  ],
  focusSymbols: ["NVDA", "2330", "2382"],
  sentiment: "bullish",
  updatedAt: "2026-06-08T00:42:00+08:00"
};

describe("briefComposer", () => {
  it("builds a shareable summary text block", () => {
    const text = composeDailyBriefText(brief, {
      selectedSymbol: "2330",
      selectedStockName: "台積電"
    });

    expect(text).toContain("台股盤前摘要");
    expect(text).toContain("NVIDIA 財測上修，AI 伺服器需求持續強勁");
    expect(text).toContain("聚焦個股：2330 台積電");
    expect(text).toContain("關注焦點：NVDA、2330、2382");
    expect(text).toContain("- TAIEX 目前 -1.33%");
  });
});
