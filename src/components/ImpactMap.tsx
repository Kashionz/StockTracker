import type { ImpactChain } from "../types";

interface ImpactMapProps {
  chains: ImpactChain[];
  selectedSymbol: string | null;
  selectedStockName: string | null;
}

const impactLabel = {
  bullish: "偏多傳導",
  bearish: "偏空傳導",
  neutral: "中性觀察"
} as const;

export function ImpactMap({
  chains,
  selectedSymbol,
  selectedStockName
}: ImpactMapProps) {
  return (
    <section className="dashboard-panel impact-panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Impact</p>
          <h2>個股影響映射</h2>
        </div>
        <p className="section-note">
          {selectedSymbol && selectedStockName
            ? `${selectedSymbol} ${selectedStockName} 的消息傳導鏈`
            : "把消息直接標的與供應鏈受影響個股串成可讀路徑"}
        </p>
      </div>

      <div className="impact-grid">
        {chains.map((chain) => (
          <article className="impact-card" key={chain.newsId}>
            <div className="impact-topline">
              <span className={`sentiment-badge sentiment-${chain.sentiment}`}>
                {impactLabel[chain.sentiment]}
              </span>
              <span>{chain.rootSymbols.join(" / ")}</span>
            </div>

            <h3>{chain.headline}</h3>

            <div className="impact-legend">
              <span>事件源頭</span>
              <span>傳導標的</span>
            </div>

            <div className="impact-event-node">
              <div className="impact-node impact-node-event">消息事件</div>
              <div className="impact-targets">
                {chain.rootSymbols.map((symbol) => (
                  <span
                    className={symbol === selectedSymbol ? "is-focused" : ""}
                    key={`${chain.newsId}-root-${symbol}`}
                  >
                    {symbol}
                  </span>
                ))}
              </div>
            </div>

            <div className="impact-branches impact-graph">
              {chain.branches.map((branch) => (
                <div className="impact-branch impact-path" key={`${chain.newsId}-${branch.sourceSymbol}`}>
                  <div className="impact-source-column">
                    <div className="impact-source">{branch.sourceSymbol}</div>
                    <p>{branch.relation}</p>
                  </div>

                  <div aria-hidden="true" className="impact-path-link">
                    <span className="impact-link-line" />
                    <span className="impact-link-arrow">→</span>
                  </div>

                  <div className="impact-target-column">
                    {branch.targets.length > 0 ? (
                      <div className="impact-targets">
                        {branch.targets.map((target) => (
                          <span
                            className={target === selectedSymbol ? "is-focused" : ""}
                            key={`${branch.sourceSymbol}-${target}`}
                          >
                            {target}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="impact-targets">
                        <span>直接關聯</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
