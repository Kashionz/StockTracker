import { relationshipLinks } from "./relationships";
import type { DashboardPayload } from "../types";

export const mockDashboardPayload: DashboardPayload = {
  lastUpdatedAt: "2026-06-07T09:32:00+08:00",
  macros: [
    {
      key: "spx",
      label: "S&P 500",
      value: "5,328.42",
      changePct: 0.82,
      sparkline: [5260, 5268, 5285, 5301, 5328],
      updatedAt: "2026-06-07T09:31:00+08:00",
      delayTag: "延遲 15 分"
    },
    {
      key: "ixic",
      label: "Nasdaq",
      value: "17,941.06",
      changePct: 1.23,
      sparkline: [17620, 17720, 17830, 17890, 17941],
      updatedAt: "2026-06-07T09:31:00+08:00",
      delayTag: "延遲 15 分"
    },
    {
      key: "sox",
      label: "SOX",
      value: "5,248.18",
      changePct: 2.14,
      sparkline: [5102, 5148, 5190, 5236, 5248],
      updatedAt: "2026-06-07T09:31:00+08:00",
      delayTag: "延遲 15 分"
    },
    {
      key: "taiex",
      label: "TAIEX",
      value: "22,245.11",
      changePct: -0.34,
      sparkline: [22340, 22318, 22298, 22276, 22245],
      updatedAt: "2026-06-07T13:31:00+08:00",
      delayTag: "盤後"
    },
    {
      key: "usd-twd",
      label: "USD/TWD",
      value: "32.18",
      changePct: -0.11,
      sparkline: [32.22, 32.2, 32.19, 32.18, 32.18],
      updatedAt: "2026-06-07T09:30:00+08:00",
      delayTag: "每日"
    },
    {
      key: "us10y",
      label: "US10Y",
      value: "4.21%",
      changePct: 0.05,
      sparkline: [4.16, 4.18, 4.2, 4.19, 4.21],
      updatedAt: "2026-06-07T08:55:00+08:00",
      delayTag: "每日"
    },
    {
      key: "vix",
      label: "VIX",
      value: "14.30",
      changePct: -2.02,
      sparkline: [15.2, 15, 14.8, 14.6, 14.3],
      updatedAt: "2026-06-07T09:31:00+08:00",
      delayTag: "延遲 15 分"
    }
  ],
  quotes: [
    {
      symbol: "NVDA",
      price: 920.4,
      changePct: 3.2,
      volume: 42865321,
      sparkline: [885, 892, 901, 914, 920.4],
      updatedAt: "2026-06-07T09:30:00+08:00",
      delayTag: "延遲 15 分"
    },
    {
      symbol: "AAPL",
      price: 211.5,
      changePct: 0.9,
      volume: 22341200,
      sparkline: [209.2, 209.8, 210.4, 211.1, 211.5],
      updatedAt: "2026-06-07T09:30:00+08:00",
      delayTag: "延遲 15 分"
    },
    {
      symbol: "MSFT",
      price: 449.9,
      changePct: 1.1,
      volume: 16420010,
      sparkline: [442.2, 444.1, 446.5, 448.2, 449.9],
      updatedAt: "2026-06-07T09:30:00+08:00",
      delayTag: "延遲 15 分"
    },
    {
      symbol: "GOOGL",
      price: 183.2,
      changePct: 0.7,
      volume: 11240091,
      sparkline: [180.8, 181.1, 182.2, 182.6, 183.2],
      updatedAt: "2026-06-07T09:30:00+08:00",
      delayTag: "延遲 15 分"
    },
    {
      symbol: "AMD",
      price: 177.6,
      changePct: 1.9,
      volume: 29553120,
      sparkline: [171.8, 173.9, 175.1, 176.3, 177.6],
      updatedAt: "2026-06-07T09:30:00+08:00",
      delayTag: "延遲 15 分"
    },
    {
      symbol: "TSLA",
      price: 182.3,
      changePct: -1.4,
      volume: 53280124,
      sparkline: [187.6, 186.2, 184.9, 183.8, 182.3],
      updatedAt: "2026-06-07T09:30:00+08:00",
      delayTag: "延遲 15 分"
    },
    {
      symbol: "AVGO",
      price: 1678.4,
      changePct: 2.5,
      volume: 5280120,
      sparkline: [1620, 1638, 1655, 1669, 1678.4],
      updatedAt: "2026-06-07T09:30:00+08:00",
      delayTag: "延遲 15 分"
    },
    {
      symbol: "2330",
      price: 945,
      changePct: 1.1,
      volume: 35128012,
      sparkline: [931, 934, 938, 942, 945],
      updatedAt: "2026-06-07T13:31:00+08:00",
      delayTag: "盤後"
    },
    {
      symbol: "2454",
      price: 1325,
      changePct: 0.8,
      volume: 5811200,
      sparkline: [1310, 1312, 1317, 1320, 1325],
      updatedAt: "2026-06-07T13:31:00+08:00",
      delayTag: "盤後"
    },
    {
      symbol: "2317",
      price: 210,
      changePct: -0.5,
      volume: 19881200,
      sparkline: [212.2, 211.9, 211.4, 210.8, 210],
      updatedAt: "2026-06-07T13:31:00+08:00",
      delayTag: "盤後"
    },
    {
      symbol: "2303",
      price: 56.1,
      changePct: 0.3,
      volume: 16721098,
      sparkline: [55.6, 55.8, 55.9, 56.0, 56.1],
      updatedAt: "2026-06-07T13:31:00+08:00",
      delayTag: "盤後"
    },
    {
      symbol: "2308",
      price: 398,
      changePct: 1.9,
      volume: 6212098,
      sparkline: [388, 390, 393, 396, 398],
      updatedAt: "2026-06-07T13:31:00+08:00",
      delayTag: "盤後"
    },
    {
      symbol: "2382",
      price: 305.5,
      changePct: 2.1,
      volume: 9311812,
      sparkline: [296.4, 298.8, 301.2, 303.1, 305.5],
      updatedAt: "2026-06-07T13:31:00+08:00",
      delayTag: "盤後"
    },
    {
      symbol: "3231",
      price: 122.5,
      changePct: 1.7,
      volume: 12881344,
      sparkline: [119.3, 119.8, 120.7, 121.4, 122.5],
      updatedAt: "2026-06-07T13:31:00+08:00",
      delayTag: "盤後"
    },
    {
      symbol: "3711",
      price: 168.5,
      changePct: 0.6,
      volume: 4021188,
      sparkline: [166.3, 166.9, 167.4, 167.9, 168.5],
      updatedAt: "2026-06-07T13:31:00+08:00",
      delayTag: "盤後"
    }
  ],
  news: [
    {
      id: "news-nvda",
      title: "NVIDIA 財測上修，AI 伺服器需求持續強勁",
      summary: "雲端客戶拉貨續強，市場預期供應鏈接單能見度同步改善。",
      source: "Reuters",
      publishedAt: "2026-06-07T09:15:00+08:00",
      sentimentScore: 0.63,
      symbols: ["NVDA"]
    },
    {
      id: "news-fed",
      title: "聯準會官員重申利率將視通膨數據而定",
      summary: "市場觀望後續政策訊號，科技權值短線維持震盪整理。",
      source: "Bloomberg",
      publishedAt: "2026-06-07T08:48:00+08:00",
      sentimentScore: null,
      symbols: ["US_RATES_HAWKISH"]
    },
    {
      id: "news-tsmc",
      title: "台積電先進封裝需求續強，供應鏈備產",
      summary: "CoWoS 產能擴張進度穩定，封測與伺服器族群情緒偏多。",
      source: "MoneyDJ",
      publishedAt: "2026-06-07T08:16:00+08:00",
      sentimentScore: 0.28,
      symbols: ["2330"]
    },
    {
      id: "news-apple",
      title: "Apple 新品發表前夕，供應鏈啟動備貨",
      summary: "鴻海與晶圓代工族群可望受惠拉貨節奏回升。",
      source: "鉅亨網",
      publishedAt: "2026-06-07T07:55:00+08:00",
      sentimentScore: 0.18,
      symbols: ["AAPL"]
    }
  ],
  relationships: relationshipLinks
};
