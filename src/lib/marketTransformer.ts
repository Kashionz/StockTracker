import { watchSectionsConfig, watchStocks } from "../data/watchlists";
import type {
  DailyBrief,
  DashboardPayload,
  DashboardSnapshot,
  ImpactChain,
  NewsCard,
  RawNewsItem,
  RelationshipLink,
  SentimentTone,
  TrendTone,
  WatchItem
} from "../types";
import { compareDateTimeDesc } from "./dateTime";

const positiveKeywords = [
  "beat",
  "strong",
  "raise",
  "growth",
  "upgrade",
  "demand",
  "擴產",
  "上修",
  "成長",
  "拉貨",
  "需求強勁",
  "利多",
  "受惠"
];

const negativeKeywords = [
  "tighten",
  "restriction",
  "slow",
  "downgrade",
  "pressure",
  "slump",
  "hawkish",
  "管制",
  "升息",
  "壓力",
  "下修",
  "疲弱",
  "利空"
];

const neutralKeywords = ["觀望", "wait", "inline", "mixed", "hold", "震盪"];

export function inferTrend(changePct: number): TrendTone {
  if (changePct > 0.05) {
    return "up";
  }

  if (changePct < -0.05) {
    return "down";
  }

  return "flat";
}

export function inferSentiment(news: Pick<RawNewsItem, "title" | "summary" | "sentimentScore">): SentimentTone {
  if (typeof news.sentimentScore === "number") {
    if (news.sentimentScore >= 0.18) {
      return "bullish";
    }

    if (news.sentimentScore <= -0.18) {
      return "bearish";
    }
  }

  const content = `${news.title} ${news.summary}`.toLowerCase();
  const hasPositive = positiveKeywords.some((keyword) => content.includes(keyword.toLowerCase()));
  const hasNegative = negativeKeywords.some((keyword) => content.includes(keyword.toLowerCase()));
  const hasNeutral = neutralKeywords.some((keyword) => content.includes(keyword.toLowerCase()));

  if (hasNeutral || (hasPositive && hasNegative)) {
    return "neutral";
  }

  if (hasPositive) {
    return "bullish";
  }

  if (hasNegative) {
    return "bearish";
  }

  return "neutral";
}

export function buildImpactTargets(
  news: Pick<RawNewsItem, "symbols"> | RawNewsItem,
  relationships: RelationshipLink[]
): string[] {
  const affectedSymbols = new Set<string>();

  for (const symbol of news.symbols) {
    affectedSymbols.add(symbol);

    for (const relation of relationships) {
      if (relation.sourceSymbol === symbol) {
        affectedSymbols.add(relation.targetSymbol);
      }
    }
  }

  return [...affectedSymbols];
}

function buildWatchItem(symbol: string, quotesBySymbol: Map<string, DashboardPayload["quotes"][number]>): WatchItem {
  const stock = watchStocks[symbol];
  const quote = quotesBySymbol.get(symbol);

  if (!stock || !quote) {
    throw new Error(`Missing stock or quote for ${symbol}`);
  }

  return {
    ...stock,
    price: quote.price,
    changePct: quote.changePct,
    volume: quote.volume,
    sparkline: quote.sparkline,
    trend: inferTrend(quote.changePct),
    updatedAt: quote.updatedAt,
    delayTag: quote.delayTag
  };
}

function buildNewsCard(news: RawNewsItem, relationships: RelationshipLink[]): NewsCard {
  return {
    id: news.id,
    title: news.title,
    summary: news.summary,
    source: news.source,
    publishedAt: news.publishedAt,
    sentiment: inferSentiment(news),
    affectedSymbols: buildImpactTargets(news, relationships),
    directSymbols: news.symbols
  };
}

function buildImpactChain(newsCard: NewsCard, relationships: RelationshipLink[]): ImpactChain {
  return {
    newsId: newsCard.id,
    headline: newsCard.title,
    sentiment: newsCard.sentiment,
    rootSymbols: newsCard.directSymbols,
    branches: newsCard.directSymbols.map((symbol) => ({
      sourceSymbol: symbol,
      targets: relationships
        .filter((relation) => relation.sourceSymbol === symbol)
        .map((relation) => relation.targetSymbol),
      relation:
        relationships.find((relation) => relation.sourceSymbol === symbol)?.relation ??
        "直接關聯"
    }))
  };
}

function formatSignedChange(changePct: number): string {
  return `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;
}

function getTaiwanSessionLabel(timestamp: string): string {
  const updatedAt = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .formatToParts(updatedAt)
    .reduce<Record<string, string>>((accumulator, part) => {
      if (part.type !== "literal") {
        accumulator[part.type] = part.value;
      }

      return accumulator;
    }, {});

  const hour = Number(parts.hour ?? "0");
  const minute = Number(parts.minute ?? "0");
  const minutesOfDay = hour * 60 + minute;

  if (minutesOfDay < 8 * 60 + 45) {
    return "台股盤前摘要";
  }

  if (minutesOfDay <= 13 * 60 + 45) {
    return "台股盤中追蹤";
  }

  return "台股盤後摘要";
}

function buildDailyBrief(
  lastUpdatedAt: string,
  marketStrip: DashboardSnapshot["marketStrip"],
  watchSections: DashboardSnapshot["watchSections"],
  newsFeed: NewsCard[]
): DailyBrief {
  const sessionLabel = getTaiwanSessionLabel(lastUpdatedAt);
  const headlineNews = newsFeed[0];
  const allWatchItems = watchSections.flatMap((section) => section.items);
  const strongestUpMover = [...allWatchItems].sort((left, right) => right.changePct - left.changePct)[0];
  const strongestDownMover = [...allWatchItems].sort((left, right) => left.changePct - right.changePct)[0];
  const macroFocus =
    marketStrip.find((macro) => macro.key === "taiex") ??
    [...marketStrip].sort(
      (left, right) => Math.abs(right.changePct) - Math.abs(left.changePct)
    )[0];
  const sentimentCounts = newsFeed.reduce(
    (accumulator, item) => {
      accumulator[item.sentiment] += 1;
      return accumulator;
    },
    { bullish: 0, bearish: 0, neutral: 0 }
  );

  const sentiment: SentimentTone =
    sentimentCounts.bullish > sentimentCounts.bearish
      ? "bullish"
      : sentimentCounts.bearish > sentimentCounts.bullish
        ? "bearish"
        : headlineNews?.sentiment ?? "neutral";

  const headline =
    headlineNews?.title ??
    `${macroFocus.label} ${formatSignedChange(macroFocus.changePct)}，維持市場主線觀察。`;

  const bullets = [
    `${macroFocus.label} 目前 ${formatSignedChange(macroFocus.changePct)}，數值來到 ${macroFocus.value}。`,
    strongestUpMover && strongestDownMover
      ? `強弱分化以 ${strongestUpMover.symbol} ${formatSignedChange(strongestUpMover.changePct)} 與 ${strongestDownMover.symbol} ${formatSignedChange(strongestDownMover.changePct)} 最具代表性。`
      : "目前尚未形成明確的強弱分化訊號。",
    `消息面統計為利多 ${sentimentCounts.bullish} 則、利空 ${sentimentCounts.bearish} 則、中性 ${sentimentCounts.neutral} 則。`,
    headlineNews
      ? `最新焦點是「${headlineNews.title}」，直接牽動 ${headlineNews.directSymbols.join(" / ")}。`
      : "目前尚未取得新的新聞焦點，建議先觀察報價與指數節奏。"
  ];

  const focusSymbols = [
    ...(headlineNews?.affectedSymbols ?? []),
    strongestUpMover?.symbol,
    strongestDownMover?.symbol
  ].filter((symbol, index, array): symbol is string => Boolean(symbol) && array.indexOf(symbol) === index).slice(0, 6);

  return {
    sessionLabel,
    headline,
    bullets,
    focusSymbols,
    sentiment,
    updatedAt: lastUpdatedAt
  };
}

export function buildDashboardSnapshot(
  payload: DashboardPayload,
  source: DashboardSnapshot["source"] = "mock"
): DashboardSnapshot {
  const quotesBySymbol = new Map(payload.quotes.map((quote) => [quote.symbol, quote]));
  const marketStrip = payload.macros.map((macro) => ({
    ...macro,
    trend: inferTrend(macro.changePct)
  }));
  const watchSections = watchSectionsConfig.map((section) => ({
    id: section.id,
    label: section.label,
    description: section.description,
    items: section.symbols.map((symbol) => buildWatchItem(symbol, quotesBySymbol))
  }));
  const newsFeed = [...payload.news]
    .sort((left, right) => compareDateTimeDesc(left.publishedAt, right.publishedAt))
    .map((news) => buildNewsCard(news, payload.relationships));

  return {
    source,
    lastUpdatedAt: payload.lastUpdatedAt,
    marketStrip,
    watchSections,
    dailyBrief: buildDailyBrief(payload.lastUpdatedAt, marketStrip, watchSections, newsFeed),
    newsFeed,
    impactChains: newsFeed.slice(0, 3).map((newsCard) => buildImpactChain(newsCard, payload.relationships))
  };
}
