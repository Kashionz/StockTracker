import type { DailyBrief } from "../types";

interface ComposeDailyBriefOptions {
  selectedSymbol?: string | null;
  selectedStockName?: string | null;
}

function formatUpdatedAt(updatedAt: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(updatedAt));
}

export function composeDailyBriefText(
  brief: DailyBrief,
  options: ComposeDailyBriefOptions = {}
): string {
  const selectedFocus =
    options.selectedSymbol && options.selectedStockName
      ? `聚焦個股：${options.selectedSymbol} ${options.selectedStockName}`
      : null;

  return [
    `${brief.sessionLabel}｜${brief.headline}`,
    `摘要時間：${formatUpdatedAt(brief.updatedAt)}`,
    selectedFocus,
    `市場節奏：${brief.sentiment === "bullish" ? "偏多" : brief.sentiment === "bearish" ? "偏空" : "中性"}`,
    `關注焦點：${brief.focusSymbols.join("、")}`,
    ...brief.bullets.map((bullet) => `- ${bullet}`)
  ]
    .filter(Boolean)
    .join("\n");
}
