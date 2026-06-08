import { mockDashboardPayload } from "../data/mockPayload";
import { watchStocks } from "../data/watchlists";
import type { DashboardPayload, RawNewsItem, RawQuote } from "../types";
import { enrichNewsSentimentWithAi } from "./aiSentiment";
import { compareDateTimeDesc } from "./dateTime";

interface FinnhubQuoteResponse {
  c: number;
  pc: number;
  t: number;
}

interface FinnhubNewsResponse {
  headline: string;
  summary: string;
  source: string;
  datetime: number;
  related?: string;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
      };
    }>;
  };
}

interface TwseStockDayResponse {
  Date: string;
  Code: string;
  Name: string;
  TradeVolume: string;
  TradeValue: string;
  OpeningPrice: string;
  HighestPrice: string;
  LowestPrice: string;
  ClosingPrice: string;
  Change: string;
  Transaction: string;
}

interface TwseMiIndexResponse {
  日期: string;
  指數: string;
  收盤指數: string;
  漲跌: string;
  漲跌點數: string;
  漲跌百分比: string;
  特殊處理註記: string;
}

interface TwseAnnouncementResponse {
  出表日期: string;
  發言日期: string;
  發言時間: string;
  公司代號: string;
  公司名稱: string;
  "主旨 ": string;
  符合條款: string;
  事實發生日: string;
  說明: string;
}

interface TwseMisResponse {
  msgArray: TwseMisQuoteResponse[];
  queryTime?: {
    sysDate?: string;
    sysTime?: string;
  };
  rtcode?: string;
}

interface TwseMisQuoteResponse {
  c?: string;
  n?: string;
  z?: string;
  pz?: string;
  y?: string;
  ov?: string;
  tv?: string;
  tlong?: string;
  d?: string;
  t?: string;
  "%"?: string;
  ex?: string;
}

interface FredObservationsResponse {
  observations?: Array<{
    date: string;
    value: string;
  }>;
}

interface FugleIntradayQuoteResponse {
  symbol?: string;
  name?: string;
  previousClose?: number;
  closePrice?: number;
  lastPrice?: number;
  changePercent?: number;
  total?: {
    tradeVolume?: number;
  };
  isClose?: boolean;
  lastUpdated?: number;
}

export interface LivePayloadOptions {
  fetchImpl?: typeof fetch;
  finnhubApiKey?: string;
  finnhubBaseUrl?: string;
  yahooBaseUrl?: string;
  fugleApiKey?: string;
  fugleBaseUrl?: string;
  twseBaseUrl?: string;
  twseMisBaseUrl?: string;
  googleNewsBaseUrl?: string;
  sentimentApiUrl?: string;
  sentimentModel?: string;
  fredApiKey?: string;
  fredBaseUrl?: string;
}

const liveUsSymbols = Object.values(watchStocks)
  .filter((stock) => stock.market === "US")
  .map((stock) => stock.symbol);

const liveTwSymbols = Object.values(watchStocks)
  .filter((stock) => stock.market === "TW")
  .map((stock) => stock.symbol);

const liveNewsSymbols = liveUsSymbols;
const twseTaiexLabel = "發行量加權股價指數";
const twseDelayTag = "官方盤後";
const twseMisDelayTag = "盤中延遲";
const fredDelayTag = "每日";
const twseMisIndexCode = "t00";
const googleNewsQuery = liveTwSymbols
  .map((symbol) => watchStocks[symbol]?.name)
  .filter(Boolean)
  .join(" OR ");
const liveTwseMisChannels = [
  "tse_t00.tw",
  ...liveTwSymbols.map((symbol) => `tse_${symbol}.tw`)
];
const twNewsAliases: Record<string, string[]> = {
  "2330": ["2330", "台積電", "台積", "TSMC"],
  "2454": ["2454", "聯發科", "MediaTek"],
  "2317": ["2317", "鴻海", "Foxconn"],
  "2303": ["2303", "聯電", "UMC"],
  "2308": ["2308", "台達電", "Delta"],
  "2382": ["2382", "廣達", "Quanta"],
  "3231": ["3231", "緯創", "Wistron"],
  "3711": ["3711", "日月光投控", "日月光", "ASE"]
};
// US indices: Finnhub's free tier rejects index symbols, so they are sourced
// from Yahoo Finance's public chart endpoint instead.
const yahooMacroSymbols: Record<string, string> = {
  spx: "^GSPC",
  ixic: "^IXIC",
  sox: "^SOX",
  vix: "^VIX"
};
const fredMacroSeries: Record<string, string> = {
  "usd-twd": "DEXTAUS",
  us10y: "DGS10"
};

function buildFinnhubUrl(
  baseUrl: string,
  pathname: string,
  params: Record<string, string>,
  apiKey?: string
) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const searchParams = new URLSearchParams(params);

  // When calling through a same-origin proxy the token is injected server-side,
  // so it is only appended for direct Finnhub calls (legacy VITE_FINNHUB_API_KEY).
  if (apiKey) {
    searchParams.set("token", apiKey);
  }

  const queryString = searchParams.toString();

  return `${normalizedBaseUrl}/${pathname}${queryString ? `?${queryString}` : ""}`;
}

function buildYahooChartUrl(baseUrl: string, symbol: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return `${normalizedBaseUrl}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
}

function buildTwseUrl(baseUrl: string, pathname: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = pathname.replace(/^\/+/, "");

  return `${normalizedBaseUrl}/${normalizedPath}`;
}

function buildTwseMisUrl(baseUrl: string, channels: string[]) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const queryString = new URLSearchParams({
    ex_ch: channels.join("|"),
    json: "1",
    delay: "0"
  }).toString();

  return `${normalizedBaseUrl}/stock/api/getStockInfo.jsp?${queryString}`;
}

function buildFugleQuoteUrl(baseUrl: string, symbol: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return `${normalizedBaseUrl}/intraday/quote/${symbol}`;
}

function buildFredSeriesUrl(baseUrl: string, seriesId: string, apiKey: string) {
  // String concat (not `new URL`) so a relative dev-proxy base like "/api/fred"
  // works — `new URL` throws on a base without an origin.
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const searchParams = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: "desc",
    limit: "5"
  });

  return `${normalizedBaseUrl}/fred/series/observations?${searchParams.toString()}`;
}

async function fetchJson<T>(url: string, fetchImpl: typeof fetch, init?: RequestInit): Promise<T> {
  const response = await fetchImpl(url, init);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.text();
}

function parseNumber(value: string): number | null {
  const normalizedValue = value.replaceAll(",", "").trim();

  if (!normalizedValue || normalizedValue === "--" || normalizedValue === "---") {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function convertRocDateToIso(dateValue: string, time = "13:30:00"): string | null {
  const normalizedValue = dateValue.trim();

  if (!/^\d{7,8}$/.test(normalizedValue)) {
    return null;
  }

  const rawYear = normalizedValue.slice(0, normalizedValue.length - 4);
  const month = normalizedValue.slice(-4, -2);
  const day = normalizedValue.slice(-2);
  const year = Number(rawYear) + 1911;

  if (!Number.isFinite(year)) {
    return null;
  }

  return `${year}-${month}-${day}T${time}+08:00`;
}

function convertRocDateTimeToIso(dateValue: string, timeValue: string): string | null {
  const normalizedTimeValue = timeValue.trim().replaceAll(":", "");

  if (!/^\d{6}$/.test(normalizedTimeValue)) {
    return convertRocDateToIso(dateValue);
  }

  const time = `${normalizedTimeValue.slice(0, 2)}:${normalizedTimeValue.slice(2, 4)}:${normalizedTimeValue.slice(4, 6)}`;

  return convertRocDateToIso(dateValue, time);
}

function convertCompactDateTimeToIso(dateValue: string, timeValue: string): string | null {
  const normalizedDateValue = dateValue.trim();
  const normalizedTimeValue = timeValue.trim();

  if (!/^\d{8}$/.test(normalizedDateValue) || !/^\d{2}:\d{2}:\d{2}$/.test(normalizedTimeValue)) {
    return null;
  }

  return `${normalizedDateValue.slice(0, 4)}-${normalizedDateValue.slice(4, 6)}-${normalizedDateValue.slice(6, 8)}T${normalizedTimeValue}+08:00`;
}

function formatThousands(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatMacroValue(macroKey: string, value: number): string {
  if (macroKey === "us10y") {
    return `${value.toFixed(2)}%`;
  }

  if (macroKey === "usd-twd" || macroKey === "vix") {
    return value.toFixed(2);
  }

  return formatThousands(value);
}

function convertEpochMicroToIso(timestamp?: number): string | null {
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(Math.trunc(Number(timestamp) / 1000)).toISOString();
}

function replaceSparklineTail(series: number[], nextValue: number): number[] {
  if (series.length === 0) {
    return [nextValue];
  }

  return [...series.slice(0, -1), nextValue];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function getMinutesOfDay(timeValue: string): number | null {
  const normalizedTimeValue = timeValue.trim();

  if (!/^\d{2}:\d{2}:\d{2}$/.test(normalizedTimeValue)) {
    return null;
  }

  const [hours, minutes] = normalizedTimeValue.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function resolveTwseMisDelayTag(quoteDate: string, queryDate: string, tradeTime: string): string | null {
  if (quoteDate !== queryDate) {
    return null;
  }

  const minutesOfDay = getMinutesOfDay(tradeTime);

  if (minutesOfDay === null) {
    return twseDelayTag;
  }

  if (minutesOfDay >= 9 * 60 && minutesOfDay < 13 * 60 + 30) {
    return twseMisDelayTag;
  }

  return twseDelayTag;
}

function buildGoogleNewsUrl(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const query = encodeURIComponent(`${googleNewsQuery} when:1d`);

  return `${normalizedBaseUrl}/rss/search?q=${query}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
}

function decodeHtmlEntities(text: string): string {
  const namedEntities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#39;": "'"
  };

  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => namedEntities[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([\da-fA-F]+);/g, (_, codePoint) => String.fromCodePoint(parseInt(codePoint, 16)));
}

function parseHtmlText(html: string): string {
  return normalizeText(
    decodeHtmlEntities(html)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  );
}

function stripTitleSuffix(title: string, source: string): string {
  const normalizedTitle = normalizeText(title);
  const normalizedSource = normalizeText(source);
  const suffix = ` - ${normalizedSource}`;

  return normalizedTitle.endsWith(suffix)
    ? normalizeText(normalizedTitle.slice(0, normalizedTitle.length - suffix.length))
    : normalizedTitle;
}

function inferTwNewsSymbols(text: string): string[] {
  const normalizedText = text.toLowerCase();

  return liveTwSymbols.filter((symbol) =>
    (twNewsAliases[symbol] ?? []).some((alias) => normalizedText.includes(alias.toLowerCase()))
  );
}

function dedupeNews(items: RawNewsItem[]): RawNewsItem[] {
  const seenKeys = new Set<string>();

  return items.filter((item) => {
    const dedupeKey = `${normalizeText(item.title).toLowerCase()}|${normalizeText(item.source).toLowerCase()}`;

    if (seenKeys.has(dedupeKey)) {
      return false;
    }

    seenKeys.add(dedupeKey);
    return true;
  });
}

function mergeQuote(baseQuote: RawQuote, quote: FinnhubQuoteResponse): RawQuote {
  const changePct =
    quote.pc === 0 ? baseQuote.changePct : Number((((quote.c - quote.pc) / quote.pc) * 100).toFixed(2));

  return {
    ...baseQuote,
    price: quote.c || baseQuote.price,
    changePct,
    updatedAt: quote.t ? new Date(quote.t * 1000).toISOString() : baseQuote.updatedAt,
    delayTag: "即時"
  };
}

function mergeFugleQuote(
  baseQuote: RawQuote,
  quote: FugleIntradayQuoteResponse
): RawQuote {
  const price = quote.lastPrice ?? quote.closePrice ?? baseQuote.price;
  const volume = quote.total?.tradeVolume ?? baseQuote.volume;
  const changePct =
    typeof quote.changePercent === "number" ? Number(quote.changePercent.toFixed(2)) : baseQuote.changePct;
  const updatedAt = convertEpochMicroToIso(quote.lastUpdated) ?? baseQuote.updatedAt;

  return {
    ...baseQuote,
    price,
    changePct,
    volume,
    sparkline: replaceSparklineTail(baseQuote.sparkline, price),
    updatedAt,
    delayTag: quote.isClose ? "盤後" : "即時"
  };
}

function mergeNews(symbol: string, items: FinnhubNewsResponse[]): RawNewsItem[] {
  return items.slice(0, 2).map((item, index) => ({
    id: `${symbol}-${index}-${item.datetime}`,
    title: item.headline,
    summary: item.summary,
    source: item.source,
    publishedAt: new Date(item.datetime * 1000).toISOString(),
    sentimentScore: null,
    symbols: item.related ? item.related.split(",").filter(Boolean) : [symbol]
  }));
}

function mapTwseAnnouncements(rows: TwseAnnouncementResponse[]): RawNewsItem[] {
  return rows
    .filter((row) => liveTwSymbols.includes(row.公司代號))
    .map((row) => {
      const title = normalizeText(`${row.公司名稱}｜${row["主旨 "]}`);
      const summary = truncateText(normalizeText(row.說明), 120);
      const publishedAt =
        convertRocDateTimeToIso(row.發言日期, row.發言時間) ??
        convertRocDateToIso(row.出表日期) ??
        new Date().toISOString();

      return {
        id: `twse-${row.公司代號}-${row.發言日期}-${row.發言時間}`,
        title,
        summary,
        source: "TWSE 重大訊息",
        publishedAt,
        sentimentScore: null,
        symbols: [row.公司代號]
      };
    })
    .sort((left, right) => compareDateTimeDesc(left.publishedAt, right.publishedAt))
    .slice(0, 6);
}

function mapGoogleNewsItems(xml: string): RawNewsItem[] {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);

  const extractTagText = (block: string, tagName: string) => {
    const match = block.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));

    return match ? decodeHtmlEntities(match[1]) : "";
  };

  return items
    .map((itemXml, index) => {
      const source = normalizeText(extractTagText(itemXml, "source") || "Google News");
      const title = stripTitleSuffix(extractTagText(itemXml, "title"), source);
      const descriptionText = parseHtmlText(extractTagText(itemXml, "description"));
      const summary = truncateText(descriptionText || title, 120);
      const publishedAt = new Date(extractTagText(itemXml, "pubDate") || Date.now());
      const symbols = inferTwNewsSymbols(`${title} ${summary}`);

      return {
        id: `google-news-${publishedAt.getTime()}-${index}`,
        title,
        summary,
        source,
        publishedAt: Number.isNaN(publishedAt.getTime())
          ? new Date().toISOString()
          : publishedAt.toISOString(),
        sentimentScore: null,
        symbols
      };
    })
    .filter((item) => item.title && item.symbols.length > 0);
}

function mergeFredMacro(
  baseMacro: DashboardPayload["macros"][number],
  response: FredObservationsResponse
): DashboardPayload["macros"][number] {
  const observations = (response.observations ?? [])
    .filter((item) => item.date && item.value && item.value !== ".")
    .map((item) => ({
      date: item.date,
      value: Number(item.value)
    }))
    .filter((item) => Number.isFinite(item.value))
    .sort((left, right) => left.date.localeCompare(right.date));

  const latest = observations.at(-1);

  if (!latest) {
    return baseMacro;
  }

  const previous = observations.at(-2);
  const changePct =
    previous && previous.value !== 0
      ? Number((((latest.value - previous.value) / previous.value) * 100).toFixed(2))
      : baseMacro.changePct;
  const sparkline =
    observations.length >= 2
      ? observations.map((item) => item.value)
      : replaceSparklineTail(baseMacro.sparkline, latest.value);

  return {
    ...baseMacro,
    value: formatMacroValue(baseMacro.key, latest.value),
    changePct,
    sparkline,
    updatedAt: new Date(`${latest.date}T00:00:00Z`).toISOString(),
    delayTag: fredDelayTag
  };
}

function mergeTwseQuote(baseQuote: RawQuote, row: TwseStockDayResponse): RawQuote {
  const closingPrice = parseNumber(row.ClosingPrice);
  const volume = parseNumber(row.TradeVolume);
  const changeValue = parseNumber(row.Change);
  const updatedAt = convertRocDateToIso(row.Date) ?? baseQuote.updatedAt;

  if (closingPrice === null) {
    return baseQuote;
  }

  const previousClose =
    changeValue === null ? null : Number((closingPrice - changeValue).toFixed(4));
  const changePct =
    previousClose && previousClose !== 0
      ? Number((((closingPrice - previousClose) / previousClose) * 100).toFixed(2))
      : baseQuote.changePct;

  return {
    ...baseQuote,
    price: closingPrice,
    changePct,
    volume: volume ?? baseQuote.volume,
    sparkline: replaceSparklineTail(baseQuote.sparkline, closingPrice),
    updatedAt,
    delayTag: twseDelayTag
  };
}

function mergeTwseMacro(
  baseMacro: DashboardPayload["macros"][number],
  row: TwseMiIndexResponse
): DashboardPayload["macros"][number] {
  const value = parseNumber(row.收盤指數);
  const changePct = parseNumber(row.漲跌百分比);
  const updatedAt = convertRocDateToIso(row.日期) ?? baseMacro.updatedAt;

  if (value === null || changePct === null) {
    return baseMacro;
  }

  return {
    ...baseMacro,
    value: formatThousands(value),
    changePct,
    sparkline: replaceSparklineTail(baseMacro.sparkline, value),
    updatedAt,
    delayTag: twseDelayTag
  };
}

function mergeTwseMisQuote(
  baseQuote: RawQuote,
  row: TwseMisQuoteResponse,
  queryDate: string,
  queryTime?: string
): RawQuote {
  const tradeTime = row.t ?? row["%"] ?? queryTime ?? "";
  const delayTag = resolveTwseMisDelayTag(row.d ?? "", queryDate, tradeTime);
  const price = parseNumber(row.z ?? row.pz ?? "");
  const previousClose = parseNumber(row.y ?? "");
  const volume = parseNumber(row.ov ?? row.tv ?? "");
  const epochMs = row.tlong ? Number(row.tlong) : Number.NaN;
  const updatedAt =
    (Number.isFinite(epochMs) ? new Date(epochMs).toISOString() : null) ??
    (row.d ? convertCompactDateTimeToIso(row.d, tradeTime) : null) ??
    baseQuote.updatedAt;

  if (!delayTag || price === null || previousClose === null || previousClose === 0) {
    return baseQuote;
  }

  return {
    ...baseQuote,
    price,
    changePct: Number((((price - previousClose) / previousClose) * 100).toFixed(2)),
    volume: volume ?? baseQuote.volume,
    sparkline: replaceSparklineTail(baseQuote.sparkline, price),
    updatedAt,
    delayTag
  };
}

function mergeTwseMisMacro(
  baseMacro: DashboardPayload["macros"][number],
  row: TwseMisQuoteResponse,
  queryDate: string,
  queryTime?: string
): DashboardPayload["macros"][number] {
  const tradeTime = row.t ?? row["%"] ?? queryTime ?? "";
  const delayTag = resolveTwseMisDelayTag(row.d ?? "", queryDate, tradeTime);
  const value = parseNumber(row.z ?? row.pz ?? "");
  const previousClose = parseNumber(row.y ?? "");
  const epochMs = row.tlong ? Number(row.tlong) : Number.NaN;
  const updatedAt =
    (Number.isFinite(epochMs) ? new Date(epochMs).toISOString() : null) ??
    (row.d ? convertCompactDateTimeToIso(row.d, tradeTime) : null) ??
    baseMacro.updatedAt;

  if (!delayTag || value === null || previousClose === null || previousClose === 0) {
    return baseMacro;
  }

  return {
    ...baseMacro,
    value: formatThousands(value),
    changePct: Number((((value - previousClose) / previousClose) * 100).toFixed(2)),
    sparkline: replaceSparklineTail(baseMacro.sparkline, value),
    updatedAt,
    delayTag
  };
}

async function mergeFinnhubData(
  payload: DashboardPayload,
  finnhubBaseUrl: string,
  finnhubApiKey: string | undefined,
  fetchImpl: typeof fetch
): Promise<boolean> {
  let hasMergedData = false;
  const quotesBySymbol = new Map(payload.quotes.map((quote) => [quote.symbol, quote]));

  const quoteResults = await Promise.allSettled(
    liveUsSymbols.map(async (symbol) => {
      const quote = await fetchJson<FinnhubQuoteResponse>(
        buildFinnhubUrl(finnhubBaseUrl, "quote", { symbol }, finnhubApiKey),
        fetchImpl
      );

      return { symbol, quote };
    })
  );

  for (const result of quoteResults) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const baseQuote = quotesBySymbol.get(result.value.symbol);

    if (!baseQuote) {
      continue;
    }

    hasMergedData = true;
    quotesBySymbol.set(result.value.symbol, mergeQuote(baseQuote, result.value.quote));
  }

  payload.quotes = [...quotesBySymbol.values()];

  // US indices come from Yahoo Finance (mergeYahooData); Finnhub's free tier
  // rejects index symbols, so they are intentionally not fetched here.

  const newsResults = await Promise.allSettled(
    liveNewsSymbols.map(async (symbol) => {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10);
      const items = await fetchJson<FinnhubNewsResponse[]>(
        buildFinnhubUrl(finnhubBaseUrl, "company-news", { symbol, from, to }, finnhubApiKey),
        fetchImpl
      );

      return mergeNews(symbol, items);
    })
  );

  const mergedNews = newsResults
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((left, right) => compareDateTimeDesc(left.publishedAt, right.publishedAt));

  if (mergedNews.length > 0) {
    hasMergedData = true;
    payload.news = [...mergedNews, ...payload.news].slice(0, 8);
  }

  return hasMergedData;
}

function mergeYahooMacro(
  baseMacro: DashboardPayload["macros"][number],
  response: YahooChartResponse
): DashboardPayload["macros"][number] {
  const result = response.chart?.result?.[0];
  const price = result?.meta?.regularMarketPrice;

  if (!result || typeof price !== "number" || !Number.isFinite(price)) {
    return baseMacro;
  }

  const previousClose = result.meta?.chartPreviousClose ?? result.meta?.previousClose;
  const changePct =
    typeof previousClose === "number" && previousClose !== 0
      ? Number((((price - previousClose) / previousClose) * 100).toFixed(2))
      : baseMacro.changePct;
  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  const sparkline =
    closes.length >= 2 ? closes.slice(-5) : replaceSparklineTail(baseMacro.sparkline, price);
  const epochMs = result.meta?.regularMarketTime ? result.meta.regularMarketTime * 1000 : Number.NaN;
  const updatedAt = Number.isFinite(epochMs) ? new Date(epochMs).toISOString() : baseMacro.updatedAt;

  return {
    ...baseMacro,
    value: formatMacroValue(baseMacro.key, price),
    changePct,
    sparkline,
    updatedAt,
    delayTag: "延遲 15 分"
  };
}

async function mergeYahooData(
  payload: DashboardPayload,
  yahooBaseUrl: string,
  fetchImpl: typeof fetch
): Promise<boolean> {
  let hasMergedData = false;
  const macrosByKey = new Map(payload.macros.map((macro) => [macro.key, macro]));

  const results = await Promise.allSettled(
    Object.entries(yahooMacroSymbols).map(async ([macroKey, symbol]) => {
      const response = await fetchJson<YahooChartResponse>(
        buildYahooChartUrl(yahooBaseUrl, symbol),
        fetchImpl
      );

      return { macroKey, response };
    })
  );

  for (const result of results) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const baseMacro = macrosByKey.get(result.value.macroKey);

    if (!baseMacro) {
      continue;
    }

    const nextMacro = mergeYahooMacro(baseMacro, result.value.response);

    if (nextMacro !== baseMacro) {
      hasMergedData = true;
      macrosByKey.set(result.value.macroKey, nextMacro);
    }
  }

  payload.macros = [...macrosByKey.values()];

  return hasMergedData;
}

async function mergeFugleData(
  payload: DashboardPayload,
  fugleBaseUrl: string,
  fugleApiKey: string | undefined,
  fetchImpl: typeof fetch
): Promise<boolean> {
  let hasMergedData = false;
  const quotesBySymbol = new Map(payload.quotes.map((quote) => [quote.symbol, quote]));
  const requestInit =
    fugleApiKey
      ? {
          headers: {
            "X-API-KEY": fugleApiKey
          }
        }
      : undefined;

  const quoteResults = await Promise.allSettled(
    liveTwSymbols.map(async (symbol) => {
      const quote = await fetchJson<FugleIntradayQuoteResponse>(
        buildFugleQuoteUrl(fugleBaseUrl, symbol),
        fetchImpl,
        requestInit
      );

      return { symbol, quote };
    })
  );

  for (const result of quoteResults) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const baseQuote = quotesBySymbol.get(result.value.symbol);

    if (!baseQuote) {
      continue;
    }

    hasMergedData = true;
    quotesBySymbol.set(result.value.symbol, mergeFugleQuote(baseQuote, result.value.quote));
  }

  payload.quotes = [...quotesBySymbol.values()];

  return hasMergedData;
}

async function mergeFredMacroData(
  payload: DashboardPayload,
  fredBaseUrl: string,
  fredApiKey: string,
  fetchImpl: typeof fetch
): Promise<boolean> {
  let hasMergedData = false;
  const macrosByKey = new Map(payload.macros.map((macro) => [macro.key, macro]));
  const macroResults = await Promise.allSettled(
    Object.entries(fredMacroSeries).map(async ([macroKey, seriesId]) => {
      const response = await fetchJson<FredObservationsResponse>(
        buildFredSeriesUrl(fredBaseUrl, seriesId, fredApiKey),
        fetchImpl
      );

      return { macroKey, response };
    })
  );

  for (const result of macroResults) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const baseMacro = macrosByKey.get(result.value.macroKey);

    if (!baseMacro) {
      continue;
    }

    const nextMacro = mergeFredMacro(baseMacro, result.value.response);

    if (nextMacro !== baseMacro) {
      hasMergedData = true;
      macrosByKey.set(result.value.macroKey, nextMacro);
    }
  }

  payload.macros = [...macrosByKey.values()];

  return hasMergedData;
}

async function mergeTwseData(
  payload: DashboardPayload,
  twseBaseUrl: string,
  fetchImpl: typeof fetch
): Promise<boolean> {
  let hasMergedData = false;

  const [stockRowsResult, indexRowsResult, announcementRowsResult] = await Promise.allSettled([
    fetchJson<TwseStockDayResponse[]>(
      buildTwseUrl(twseBaseUrl, "exchangeReport/STOCK_DAY_ALL"),
      fetchImpl
    ),
    fetchJson<TwseMiIndexResponse[]>(
      buildTwseUrl(twseBaseUrl, "exchangeReport/MI_INDEX"),
      fetchImpl
    ),
    fetchJson<TwseAnnouncementResponse[]>(
      buildTwseUrl(twseBaseUrl, "opendata/t187ap04_L"),
      fetchImpl
    )
  ]);

  if (stockRowsResult.status === "fulfilled") {
    const quotesBySymbol = new Map(payload.quotes.map((quote) => [quote.symbol, quote]));
    const rowsByCode = new Map(
      stockRowsResult.value
        .filter((row) => liveTwSymbols.includes(row.Code))
        .map((row) => [row.Code, row])
    );

    for (const symbol of liveTwSymbols) {
      const baseQuote = quotesBySymbol.get(symbol);
      const row = rowsByCode.get(symbol);

      if (!baseQuote || !row) {
        continue;
      }

      hasMergedData = true;
      quotesBySymbol.set(symbol, mergeTwseQuote(baseQuote, row));
    }

    payload.quotes = [...quotesBySymbol.values()];
  }

  if (indexRowsResult.status === "fulfilled") {
    const taiexRow = indexRowsResult.value.find((row) => row.指數 === twseTaiexLabel);

    if (taiexRow) {
      payload.macros = payload.macros.map((macro) =>
        macro.key === "taiex" ? mergeTwseMacro(macro, taiexRow) : macro
      );
      hasMergedData = true;
    }
  }

  if (announcementRowsResult.status === "fulfilled") {
    const announcements = mapTwseAnnouncements(announcementRowsResult.value);

    if (announcements.length > 0) {
      payload.news = [...announcements, ...payload.news]
        .sort((left, right) => compareDateTimeDesc(left.publishedAt, right.publishedAt))
        .slice(0, 12);
      hasMergedData = true;
    }
  }

  return hasMergedData;
}

async function mergeTwseMisData(
  payload: DashboardPayload,
  twseMisBaseUrl: string,
  fetchImpl: typeof fetch
): Promise<boolean> {
  const response = await fetchJson<TwseMisResponse>(
    buildTwseMisUrl(twseMisBaseUrl, liveTwseMisChannels),
    fetchImpl
  );
  const queryDate = response.queryTime?.sysDate ?? "";
  const queryTime = response.queryTime?.sysTime;

  if (response.rtcode && response.rtcode !== "0000") {
    return false;
  }

  let hasMergedData = false;
  const quotesBySymbol = new Map(payload.quotes.map((quote) => [quote.symbol, quote]));
  const rowsByCode = new Map(
    response.msgArray
      .filter((row) => row.c && liveTwSymbols.includes(row.c))
      .map((row) => [row.c as string, row])
  );

  for (const symbol of liveTwSymbols) {
    const baseQuote = quotesBySymbol.get(symbol);
    const row = rowsByCode.get(symbol);

    if (!baseQuote || !row) {
      continue;
    }

    const nextQuote = mergeTwseMisQuote(baseQuote, row, queryDate, queryTime);

    if (nextQuote !== baseQuote) {
      hasMergedData = true;
      quotesBySymbol.set(symbol, nextQuote);
    }
  }

  payload.quotes = [...quotesBySymbol.values()];

  const taiexRow = response.msgArray.find((row) => row.c === twseMisIndexCode);

  if (taiexRow) {
    let macroUpdated = false;

    payload.macros = payload.macros.map((macro) => {
      if (macro.key !== "taiex") {
        return macro;
      }

      const nextMacro = mergeTwseMisMacro(macro, taiexRow, queryDate, queryTime);

      if (nextMacro !== macro) {
        macroUpdated = true;
      }

      return nextMacro;
    });

    hasMergedData = macroUpdated || hasMergedData;
  }

  return hasMergedData;
}

async function mergeGoogleNewsData(
  payload: DashboardPayload,
  googleNewsBaseUrl: string,
  fetchImpl: typeof fetch
): Promise<boolean> {
  const rssText = await fetchText(buildGoogleNewsUrl(googleNewsBaseUrl), fetchImpl);
  const newsItems = mapGoogleNewsItems(rssText);

  if (newsItems.length === 0) {
    return false;
  }

  payload.news = dedupeNews([...newsItems, ...payload.news])
    .sort((left, right) => compareDateTimeDesc(left.publishedAt, right.publishedAt))
    .slice(0, 12);

  return true;
}

// Isolates a single provider's failure so one bad source (e.g. a redirecting
// endpoint or an unexpected non-JSON body) cannot discard data that other
// providers already merged or collapse the whole load to mock.
async function runProvider(merge: () => Promise<boolean>): Promise<boolean> {
  try {
    return await merge();
  } catch {
    return false;
  }
}

// Blank env overrides (e.g. `VITE_TWSE_BASE_URL=` in .env.local) must read as
// unset so the dev proxy defaults still apply. Plain `??` keeps the empty string
// and silently disables the provider.
export function cleanEnv(value: string | undefined): string | undefined {
  return value && value.trim() !== "" ? value : undefined;
}

export async function loadLiveDashboardPayload(
  options: LivePayloadOptions = {}
): Promise<DashboardPayload | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const finnhubDirectKey = options.finnhubApiKey ?? cleanEnv(import.meta.env.VITE_FINNHUB_API_KEY);
  const finnhubBaseUrl =
    options.finnhubBaseUrl ??
    cleanEnv(import.meta.env.VITE_FINNHUB_BASE_URL) ??
    (import.meta.env.MODE === "development"
      ? "/api/finnhub"
      : finnhubDirectKey
        ? "https://finnhub.io/api/v1"
        : undefined);
  // The token is only attached for direct browser → Finnhub calls; same-origin
  // proxies (dev /api/finnhub or a custom VITE_FINNHUB_BASE_URL) inject it server-side.
  const finnhubApiKey =
    finnhubBaseUrl === "https://finnhub.io/api/v1" ? finnhubDirectKey : undefined;
  const yahooBaseUrl =
    options.yahooBaseUrl ??
    cleanEnv(import.meta.env.VITE_YAHOO_BASE_URL) ??
    (import.meta.env.MODE === "development" ? "/api/yahoo" : undefined);
  const fugleApiKey = options.fugleApiKey ?? cleanEnv(import.meta.env.VITE_FUGLE_API_KEY);
  const fugleBaseUrl =
    options.fugleBaseUrl ??
    cleanEnv(import.meta.env.VITE_FUGLE_BASE_URL) ??
    (import.meta.env.MODE === "development" ? "/api/fugle" : undefined);
  const twseBaseUrl =
    options.twseBaseUrl ??
    cleanEnv(import.meta.env.VITE_TWSE_BASE_URL) ??
    (import.meta.env.MODE === "development" ? "/api/twse" : undefined);
  const twseMisBaseUrl =
    options.twseMisBaseUrl ??
    cleanEnv(import.meta.env.VITE_TWSE_MIS_BASE_URL) ??
    (import.meta.env.MODE === "development" ? "/api/twse-mis" : undefined);
  const googleNewsBaseUrl =
    options.googleNewsBaseUrl ??
    cleanEnv(import.meta.env.VITE_GOOGLE_NEWS_BASE_URL) ??
    (import.meta.env.MODE === "development" ? "/api/google-news" : undefined);
  const sentimentApiUrl =
    options.sentimentApiUrl ??
    cleanEnv(import.meta.env.VITE_SENTIMENT_API_URL) ??
    (import.meta.env.MODE === "development" ? "/api/ai-sentiment" : undefined);
  const sentimentModel =
    options.sentimentModel ??
    cleanEnv(import.meta.env.VITE_SENTIMENT_MODEL) ??
    "gpt-5-mini";
  const fredApiKey = options.fredApiKey ?? cleanEnv(import.meta.env.VITE_FRED_API_KEY);
  const fredBaseUrl =
    options.fredBaseUrl ??
    cleanEnv(import.meta.env.VITE_FRED_BASE_URL) ??
    (import.meta.env.MODE === "development" ? "/api/fred" : undefined);

  const basePayload: DashboardPayload = JSON.parse(JSON.stringify(mockDashboardPayload));
  let hasMergedData = false;

  if (finnhubBaseUrl) {
    hasMergedData =
      (await runProvider(() =>
        mergeFinnhubData(basePayload, finnhubBaseUrl, finnhubApiKey, fetchImpl)
      )) || hasMergedData;
  }

  if (yahooBaseUrl) {
    hasMergedData =
      (await runProvider(() => mergeYahooData(basePayload, yahooBaseUrl, fetchImpl))) ||
      hasMergedData;
  }

  if (twseBaseUrl) {
    hasMergedData =
      (await runProvider(() => mergeTwseData(basePayload, twseBaseUrl, fetchImpl))) || hasMergedData;
  }

  if (twseMisBaseUrl) {
    hasMergedData =
      (await runProvider(() => mergeTwseMisData(basePayload, twseMisBaseUrl, fetchImpl))) ||
      hasMergedData;
  }

  if (fugleBaseUrl) {
    hasMergedData =
      (await runProvider(() => mergeFugleData(basePayload, fugleBaseUrl, fugleApiKey, fetchImpl))) ||
      hasMergedData;
  }

  if (googleNewsBaseUrl) {
    hasMergedData =
      (await runProvider(() => mergeGoogleNewsData(basePayload, googleNewsBaseUrl, fetchImpl))) ||
      hasMergedData;
  }

  if (fredBaseUrl && fredApiKey) {
    hasMergedData =
      (await runProvider(() =>
        mergeFredMacroData(basePayload, fredBaseUrl, fredApiKey, fetchImpl)
      )) || hasMergedData;
  }

  if (!hasMergedData) {
    return null;
  }

  if (sentimentApiUrl) {
    try {
      basePayload.news = await enrichNewsSentimentWithAi(basePayload.news, {
        apiUrl: sentimentApiUrl,
        fetchImpl,
        model: sentimentModel
      });
    } catch {
      // Keep fallback keyword-based sentiment inference when the AI provider is unavailable.
    }
  }

  return {
    ...basePayload,
    lastUpdatedAt: new Date().toISOString()
  };
}
