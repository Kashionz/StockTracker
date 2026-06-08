import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImpactMap } from "./ImpactMap";

describe("ImpactMap", () => {
  it("renders event, source, and target nodes in the impact graph", () => {
    render(
      <ImpactMap
        chains={[
          {
            newsId: "news-nvda",
            headline: "NVIDIA 財測上修，AI 伺服器需求持續強勁",
            sentiment: "bullish",
            rootSymbols: ["NVDA"],
            branches: [
              {
                sourceSymbol: "NVDA",
                targets: ["2330", "2382", "3231"],
                relation: "AI 晶片需求拉動先進製程"
              }
            ]
          }
        ]}
        selectedSymbol="2382"
        selectedStockName="廣達"
      />
    );

    expect(screen.getByText("NVIDIA 財測上修，AI 伺服器需求持續強勁")).toBeInTheDocument();
    expect(screen.getByText("事件源頭")).toBeInTheDocument();
    expect(screen.getByText("傳導標的")).toBeInTheDocument();
    expect(screen.getAllByText("NVDA").length).toBeGreaterThan(0);
    expect(screen.getByText("2330")).toBeInTheDocument();
    expect(screen.getByText("2382")).toHaveClass("is-focused");
  });
});
