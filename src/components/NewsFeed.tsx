import type { NewsCard } from "../types";

interface NewsFeedProps {
  items: NewsCard[];
  selectedSymbol: string | null;
  selectedStockName: string | null;
}

const sentimentLabel = {
  bullish: "利多",
  bearish: "利空",
  neutral: "中性"
} as const;

function formatPublishedAt(publishedAt: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(publishedAt));
}

export function NewsFeed({ items, selectedSymbol, selectedStockName }: NewsFeedProps) {
  return (
    <section className="dashboard-panel news-panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">News</p>
          <h2>新聞情緒</h2>
        </div>
        <p className="section-note">
          {selectedSymbol && selectedStockName
            ? `目前聚焦 ${selectedSymbol} ${selectedStockName}`
            : "依時間倒序呈現利多、利空與中性消息"}
        </p>
      </div>

      <div className="news-list">
        {items.map((item) => (
          <article className={`news-card sentiment-${item.sentiment}`} key={item.id}>
            <div className="news-card-head">
              <span className={`sentiment-badge sentiment-${item.sentiment}`}>
                {sentimentLabel[item.sentiment]}
              </span>
              <span className="news-timestamp">{formatPublishedAt(item.publishedAt)}</span>
            </div>

            <h3>{item.title}</h3>
            <p>{item.summary}</p>

            <div className="affected-symbols">
              {item.affectedSymbols.map((symbol) => (
                <span className={symbol === selectedSymbol ? "is-focused" : ""} key={`${item.id}-${symbol}`}>
                  {symbol}
                </span>
              ))}
            </div>

            <div className="card-meta">
              <span>{item.source}</span>
              <span>{item.directSymbols.join(" / ")}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
