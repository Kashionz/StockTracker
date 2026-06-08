import type { WatchSectionConfig, WatchStock } from "../types";

export const watchStocks: Record<string, WatchStock> = {
  NVDA: { symbol: "NVDA", name: "NVIDIA", market: "US", category: "AI 晶片" },
  AAPL: { symbol: "AAPL", name: "Apple", market: "US", category: "消費電子" },
  MSFT: { symbol: "MSFT", name: "Microsoft", market: "US", category: "軟體／雲端" },
  GOOGL: { symbol: "GOOGL", name: "Alphabet", market: "US", category: "網路／AI" },
  AMD: { symbol: "AMD", name: "AMD", market: "US", category: "半導體" },
  TSLA: { symbol: "TSLA", name: "Tesla", market: "US", category: "電動車" },
  AVGO: { symbol: "AVGO", name: "Broadcom", market: "US", category: "半導體／網通" },
  "2330": { symbol: "2330", name: "台積電", market: "TW", category: "晶圓代工" },
  "2454": { symbol: "2454", name: "聯發科", market: "TW", category: "IC 設計" },
  "2317": { symbol: "2317", name: "鴻海", market: "TW", category: "電子代工／AI 伺服器" },
  "2303": { symbol: "2303", name: "聯電", market: "TW", category: "晶圓代工" },
  "2308": { symbol: "2308", name: "台達電", market: "TW", category: "電源／散熱" },
  "2382": { symbol: "2382", name: "廣達", market: "TW", category: "AI 伺服器組裝" },
  "3231": { symbol: "3231", name: "緯創", market: "TW", category: "AI 伺服器組裝" },
  "3711": { symbol: "3711", name: "日月光投控", market: "TW", category: "封測" }
};

export const watchSectionsConfig: WatchSectionConfig[] = [
  {
    id: "us-tech",
    label: "美股科技權值",
    description: "聚焦 AI、消費電子與雲端權值。",
    symbols: ["NVDA", "AAPL", "MSFT", "GOOGL", "AMD", "TSLA", "AVGO"]
  },
  {
    id: "tw-semi",
    label: "台股半導體",
    description: "以權值與半導體主線掌握台股方向。",
    symbols: ["2330", "2454", "2317", "2303", "2308"]
  },
  {
    id: "ai-supply-chain",
    label: "AI 供應鏈",
    description: "呈現跨市場 AI 傳導與供應鏈受惠輪動。",
    symbols: ["NVDA", "AVGO", "2382", "3231", "3711", "2308"]
  }
];
