import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DailyBrief } from "./DailyBrief";

describe("DailyBrief", () => {
  it("copies the generated summary text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText
      }
    });

    render(
      <DailyBrief
        brief={{
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
        }}
        selectedSymbol="2330"
        selectedStockName="台積電"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "複製摘要文字" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledOnce();
      expect(writeText.mock.calls[0][0]).toContain("聚焦個股：2330 台積電");
      expect(screen.getByText("已複製摘要")).toBeInTheDocument();
    });
  });

  it("surfaces an error status when the clipboard write rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText
      }
    });

    render(
      <DailyBrief
        brief={{
          sessionLabel: "台股盤前摘要",
          headline: "測試標題",
          bullets: ["重點一"],
          focusSymbols: ["2330"],
          sentiment: "neutral",
          updatedAt: "2026-06-08T00:42:00+08:00"
        }}
        selectedSymbol={null}
        selectedStockName={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "複製摘要文字" }));

    await waitFor(() => {
      expect(screen.getByText("目前瀏覽器不支援直接複製")).toBeInTheDocument();
    });
  });
});
