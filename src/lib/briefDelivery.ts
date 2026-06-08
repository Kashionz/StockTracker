import type { BriefHistoryEntry, DashboardSnapshot } from "../types";

export type BriefWebhookFormat = "json" | "slack";

export interface DeliverBriefEntriesOptions {
  webhookUrl: string;
  fetchImpl?: typeof fetch;
  format?: BriefWebhookFormat;
  source?: DashboardSnapshot["source"];
}

function buildSlackText(entries: BriefHistoryEntry[], source?: DashboardSnapshot["source"]) {
  const latestEntry = entries[entries.length - 1];

  if (!latestEntry) {
    return "";
  }

  return [
    `${latestEntry.label}｜${latestEntry.headline}`,
    `來源：${source === "live" ? "live" : "mock"}`,
    `焦點：${latestEntry.focusSymbols.join("、")}`,
    latestEntry.text
  ].join("\n");
}

function buildWebhookPayload(
  entries: BriefHistoryEntry[],
  format: BriefWebhookFormat,
  source?: DashboardSnapshot["source"]
) {
  if (format === "slack") {
    return {
      text: buildSlackText(entries, source)
    };
  }

  return {
    source: source ?? "mock",
    generatedAt: entries[entries.length - 1]?.createdAt ?? new Date().toISOString(),
    entries
  };
}

export async function deliverBriefEntries(
  entries: BriefHistoryEntry[],
  options: DeliverBriefEntriesOptions
) {
  if (!options.webhookUrl || entries.length === 0) {
    return false;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const format = options.format ?? "json";
  const response = await fetchImpl(options.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildWebhookPayload(entries, format, options.source))
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Webhook delivery failed: ${response.status} ${errorText}`.trim());
  }

  return true;
}
