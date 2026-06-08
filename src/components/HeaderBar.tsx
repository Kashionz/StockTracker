import type { Dispatch, SetStateAction } from "react";

type ColorMode = "tw" | "intl";

interface HeaderBarProps {
  lastUpdatedAt: string | null;
  source: "live" | "mock";
  isLoading: boolean;
  colorMode: ColorMode;
  onRefresh: () => void;
  onColorModeChange: Dispatch<SetStateAction<ColorMode>>;
}

function formatDateTime(dateString: string | null) {
  if (!dateString) {
    return "讀取中";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(dateString));
}

export function HeaderBar({
  lastUpdatedAt,
  source,
  isLoading,
  colorMode,
  onRefresh,
  onColorModeChange
}: HeaderBarProps) {
  return (
    <header className="dashboard-header">
      <div>
        <h1>股市分析面板</h1>
        <p className="section-note">
          準即時消息 × 個股傳導
          <span className="dot-separator">•</span>
          最後更新 {formatDateTime(lastUpdatedAt)}
          <span className="dot-separator">•</span>
          {source === "live" ? "多來源 live 覆蓋" : "MVP 基準資料"}
        </p>
      </div>

      <div className="header-actions">
        <div className="mode-switch" aria-label="漲跌配色模式">
          <button
            aria-pressed={colorMode === "tw"}
            className={colorMode === "tw" ? "is-active" : ""}
            onClick={() => {
              onColorModeChange("tw");
            }}
            type="button"
          >
            台股色盤
          </button>
          <button
            aria-pressed={colorMode === "intl"}
            className={colorMode === "intl" ? "is-active" : ""}
            onClick={() => {
              onColorModeChange("intl");
            }}
            type="button"
          >
            國際色盤
          </button>
        </div>

        <button className="refresh-button" onClick={onRefresh} type="button">
          {isLoading ? "更新中…" : "手動刷新"}
        </button>
      </div>
    </header>
  );
}
