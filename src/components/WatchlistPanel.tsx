import type { WatchSection } from "../types";
import { Sparkline } from "./Sparkline";

interface WatchlistPanelProps {
  sections: WatchSection[];
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
}

function formatPrice(symbol: string, price: number) {
  const isUs = /^[A-Z]+$/.test(symbol);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: isUs ? "USD" : "TWD",
    maximumFractionDigits: isUs ? 2 : 1
  }).format(price);
}

function formatVolume(volume: number) {
  return new Intl.NumberFormat("zh-TW", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(volume);
}

function formatChange(changePct: number) {
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(2)}%`;
}

export function WatchlistPanel({
  sections,
  selectedSymbol,
  onSelectSymbol
}: WatchlistPanelProps) {
  return (
    <section className="dashboard-panel watchlist-panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Watchlist</p>
          <h2>關注個股</h2>
        </div>
        <p className="section-note">點選個股可篩出對應消息與供應鏈連動</p>
      </div>

      <div className="watchlist-sections">
        {sections.map((section) => (
          <section className="watch-group" key={section.id}>
            <div className="watch-group-header">
              <h3>{section.label}</h3>
              <p>{section.description}</p>
            </div>

            <div className="watch-items">
              {section.items.map((item) => {
                const selected = item.symbol === selectedSymbol;

                return (
                  <button
                    aria-label={`${item.symbol} ${item.name}`}
                    aria-pressed={selected}
                    className={`watch-row ${selected ? "is-selected" : ""}`}
                    key={`${section.id}-${item.symbol}`}
                    onClick={() => {
                      onSelectSymbol(item.symbol);
                    }}
                    type="button"
                  >
                    <div className="watch-row-top">
                      <div className="watch-id">
                        <span className="watch-item-symbol">{item.symbol}</span>
                        <span className="watch-item-name">{item.name}</span>
                      </div>

                      <div className="watch-quote">
                        <span className="watch-price">{formatPrice(item.symbol, item.price)}</span>
                        <span className={`trend-pill trend-${item.trend}`}>{formatChange(item.changePct)}</span>
                      </div>
                    </div>

                    <div className="watch-row-bottom">
                      <Sparkline points={item.sparkline} trend={item.trend} />

                      <div className="watch-meta">
                        <span>{formatVolume(item.volume)} · {item.category}</span>
                        <span>{item.delayTag} · {item.market}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
