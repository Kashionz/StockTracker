import type { MacroCard } from "../types";
import { Sparkline } from "./Sparkline";

interface MarketStripProps {
  indicators: MacroCard[];
}

function formatChange(changePct: number) {
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(2)}%`;
}

export function MarketStrip({ indicators }: MarketStripProps) {
  return (
    <section className="dashboard-panel market-panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Macro</p>
          <h2>大盤與總經</h2>
        </div>
        <p className="section-note">指數、匯率、利率與波動度一次看</p>
      </div>

      <div className="market-strip-grid">
        {indicators.map((indicator) => (
          <article className="market-card" key={indicator.key}>
            <div className="market-card-topline">
              <span>{indicator.label}</span>
              <span className={`trend-pill trend-${indicator.trend}`}>{formatChange(indicator.changePct)}</span>
            </div>

            <div className="market-card-value">{indicator.value}</div>
            <Sparkline points={indicator.sparkline} trend={indicator.trend} />

            <div className="card-meta">
              <span>{indicator.delayTag}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
