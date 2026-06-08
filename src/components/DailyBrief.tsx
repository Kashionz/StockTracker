import { useState } from "react";
import type { DailyBrief as DailyBriefModel } from "../types";
import { composeDailyBriefText } from "../lib/briefComposer";

interface DailyBriefProps {
  brief: DailyBriefModel | null;
  selectedSymbol: string | null;
  selectedStockName: string | null;
}

const sentimentLabel = {
  bullish: "偏多節奏",
  bearish: "偏空節奏",
  neutral: "中性整理"
} as const;

function formatUpdatedAt(updatedAt: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(updatedAt));
}

export function DailyBrief({
  brief,
  selectedSymbol,
  selectedStockName
}: DailyBriefProps) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");

  if (!brief) {
    return null;
  }

  const exportText = composeDailyBriefText(brief, {
    selectedSymbol,
    selectedStockName
  });

  const handleCopy = async () => {
    if (!navigator.clipboard?.writeText) {
      setCopyState("error");
      return;
    }

    await navigator.clipboard.writeText(exportText);
    setCopyState("done");
  };

  return (
    <section className="dashboard-panel brief-panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Brief</p>
          <h2>盤前／盤後摘要</h2>
        </div>
        <p className="section-note">
          {selectedSymbol && selectedStockName
            ? `目前同步檢視 ${selectedSymbol} ${selectedStockName} 與整體市場節奏`
            : "每次刷新自動整理市場節奏、消息重點與關注標的"}
        </p>
      </div>

      <div className="brief-grid">
        <div className="brief-main">
          <div className="brief-topline">
            <span className="brief-session">{brief.sessionLabel}</span>
            <span className={`sentiment-badge sentiment-${brief.sentiment}`}>
              {sentimentLabel[brief.sentiment]}
            </span>
          </div>

          <h3>{brief.headline}</h3>

          <ul className="brief-bullets">
            {brief.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>

        <aside className="brief-side">
          <div className="brief-side-card">
            <p className="brief-side-label">關注焦點</p>
            <div className="affected-symbols">
              {brief.focusSymbols.map((symbol) => (
                <span className={symbol === selectedSymbol ? "is-focused" : ""} key={symbol}>
                  {symbol}
                </span>
              ))}
            </div>
          </div>

          <div className="brief-side-card">
            <p className="brief-side-label">摘要時間</p>
            <strong>{formatUpdatedAt(brief.updatedAt)}</strong>
            <p className="section-note">依最新一次刷新自動重整</p>
          </div>

          <div className="brief-side-card">
            <div className="brief-export-head">
              <p className="brief-side-label">摘要輸出</p>
              <button
                aria-label="複製摘要文字"
                className="secondary-button"
                onClick={() => {
                  void handleCopy();
                }}
                type="button"
              >
                複製摘要
              </button>
            </div>

            <pre className="brief-export-preview">{exportText}</pre>

            <p className="section-note brief-copy-status">
              {copyState === "done"
                ? "已複製摘要"
                : copyState === "error"
                  ? "目前瀏覽器不支援直接複製"
                  : "可直接貼到 Slack、LINE 或每日盤前 / 盤後通知"}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
