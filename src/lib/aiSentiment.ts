import type { RawNewsItem } from "../types";

type SentimentLabel = "bullish" | "bearish" | "neutral";

interface SentimentClassificationResponse {
  items: Array<{
    id: string;
    sentiment: SentimentLabel;
    confidence: number;
  }>;
}

interface OpenAIResponsePayload {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  output_text?: string;
}

export interface AiSentimentOptions {
  apiUrl: string;
  fetchImpl?: typeof fetch;
  model?: string;
}

const defaultSentimentModel = "gpt-5-mini";
const sentimentCache = new Map<string, number>();

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function getCacheKey(item: RawNewsItem) {
  return normalizeText(`${item.title}|${item.summary}|${item.source}`).toLowerCase();
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function mapSentimentToScore(sentiment: SentimentLabel, confidence: number) {
  const normalizedConfidence = clampConfidence(confidence);

  if (sentiment === "bullish") {
    return normalizedConfidence;
  }

  if (sentiment === "bearish") {
    return -normalizedConfidence;
  }

  return 0;
}

function extractResponseText(payload: OpenAIResponsePayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  throw new Error("Missing model output text");
}

async function classifyNewsBatch(
  items: RawNewsItem[],
  options: Required<Pick<AiSentimentOptions, "apiUrl" | "model">> & {
    fetchImpl: typeof fetch;
  }
): Promise<SentimentClassificationResponse["items"]> {
  const response = await options.fetchImpl(options.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model,
      instructions:
        "你是股市新聞情緒分類器。請根據每則新聞對受影響個股或市場的含義，輸出 bullish、bearish 或 neutral。請只輸出符合 JSON schema 的內容。",
      input: items
        .map(
          (item) =>
            `ID: ${item.id}\n標題: ${item.title}\n摘要: ${item.summary}\n標的: ${item.symbols.join(", ")}`
        )
        .join("\n\n---\n\n"),
      text: {
        format: {
          type: "json_schema",
          name: "news_sentiment_batch",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "sentiment", "confidence"],
                  properties: {
                    id: { type: "string" },
                    sentiment: {
                      type: "string",
                      enum: ["bullish", "bearish", "neutral"]
                    },
                    confidence: {
                      type: "number",
                      minimum: 0,
                      maximum: 1
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Sentiment request failed: ${response.status}`);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const parsedPayload = JSON.parse(extractResponseText(payload)) as SentimentClassificationResponse;

  return parsedPayload.items;
}

export async function enrichNewsSentimentWithAi(
  items: RawNewsItem[],
  options: AiSentimentOptions
): Promise<RawNewsItem[]> {
  if (!options.apiUrl || items.length === 0) {
    return items;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? defaultSentimentModel;
  const pendingItems = items.filter((item) => !sentimentCache.has(getCacheKey(item)));

  if (pendingItems.length > 0) {
    const classifications = await classifyNewsBatch(pendingItems, {
      apiUrl: options.apiUrl,
      fetchImpl,
      model
    });
    const scoreById = new Map(
      classifications.map((item) => [
        item.id,
        mapSentimentToScore(item.sentiment, item.confidence)
      ])
    );

    for (const item of pendingItems) {
      const score = scoreById.get(item.id);

      if (typeof score === "number") {
        sentimentCache.set(getCacheKey(item), score);
      }
    }
  }

  return items.map((item) => {
    const cachedScore = sentimentCache.get(getCacheKey(item));

    return typeof cachedScore === "number"
      ? {
          ...item,
          sentimentScore: cachedScore
        }
      : item;
  });
}
