export type MarketCode = "US" | "TW";

export type TrendTone = "up" | "down" | "flat";

export type SentimentTone = "bullish" | "bearish" | "neutral";

export interface WatchStock {
  symbol: string;
  name: string;
  market: MarketCode;
  category: string;
  note?: string;
}

export interface WatchSectionConfig {
  id: string;
  label: string;
  description: string;
  symbols: string[];
}

export interface RelationshipLink {
  sourceSymbol: string;
  targetSymbol: string;
  relation: string;
  impact: "positive" | "negative" | "mixed";
}

export interface RawMacroIndicator {
  key: string;
  label: string;
  value: string;
  changePct: number;
  sparkline: number[];
  updatedAt: string;
  delayTag: string;
}

export interface RawQuote {
  symbol: string;
  price: number;
  changePct: number;
  volume: number;
  sparkline: number[];
  updatedAt: string;
  delayTag: string;
}

export interface RawNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  sentimentScore: number | null;
  symbols: string[];
}

export interface DashboardPayload {
  lastUpdatedAt: string;
  macros: RawMacroIndicator[];
  quotes: RawQuote[];
  news: RawNewsItem[];
  relationships: RelationshipLink[];
}

export interface MacroCard {
  key: string;
  label: string;
  value: string;
  changePct: number;
  trend: TrendTone;
  sparkline: number[];
  updatedAt: string;
  delayTag: string;
}

export interface WatchItem extends WatchStock {
  price: number;
  changePct: number;
  volume: number;
  sparkline: number[];
  trend: TrendTone;
  updatedAt: string;
  delayTag: string;
}

export interface WatchSection {
  id: string;
  label: string;
  description: string;
  items: WatchItem[];
}

export interface NewsCard {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  sentiment: SentimentTone;
  affectedSymbols: string[];
  directSymbols: string[];
}

export interface DailyBrief {
  sessionLabel: string;
  headline: string;
  bullets: string[];
  focusSymbols: string[];
  sentiment: SentimentTone;
  updatedAt: string;
}

export type BriefScheduleId = "tw-pre" | "tw-post" | "us-post";

export interface BriefSchedule {
  id: BriefScheduleId;
  label: string;
  description: string;
  time: string;
  enabled: boolean;
}

export interface BriefHistoryEntry {
  id: string;
  scheduleId: BriefScheduleId | "manual";
  label: string;
  headline: string;
  text: string;
  createdAt: string;
  sentiment: SentimentTone;
  focusSymbols: string[];
}

export interface ImpactChain {
  newsId: string;
  headline: string;
  sentiment: SentimentTone;
  rootSymbols: string[];
  branches: Array<{
    sourceSymbol: string;
    targets: string[];
    relation: string;
  }>;
}

export interface DashboardSnapshot {
  source: "live" | "mock";
  lastUpdatedAt: string;
  marketStrip: MacroCard[];
  watchSections: WatchSection[];
  dailyBrief: DailyBrief;
  newsFeed: NewsCard[];
  impactChains: ImpactChain[];
}
