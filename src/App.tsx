import {
  useEffect,
  useRef,
  useState
} from "react";
import { DailyBrief } from "./components/DailyBrief";
import { HeaderBar } from "./components/HeaderBar";
import { ImpactMap } from "./components/ImpactMap";
import { MarketStrip } from "./components/MarketStrip";
import { NewsFeed } from "./components/NewsFeed";
import { SchedulePanel } from "./components/SchedulePanel";
import { WatchlistPanel } from "./components/WatchlistPanel";
import { loadDashboardSnapshot } from "./lib/dashboardLoader";
import { getRefreshIntervalMs } from "./lib/marketHours";
import type { DashboardSnapshot } from "./types";

type ColorMode = "tw" | "intl";

function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("tw");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshSnapshot = async (force = false) => {
    if (!mountedRef.current) {
      return;
    }

    setLoading(true);

    try {
      const nextSnapshot = await loadDashboardSnapshot({ force });

      if (!mountedRef.current) {
        return;
      }

      setSnapshot(nextSnapshot);
      setErrorMessage(null);
    } catch {
      if (mountedRef.current) {
        setErrorMessage("目前無法更新資料，畫面保留最近一次結果。");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let timerId: number | undefined;

    // Self-rescheduling timer: refreshes every minute while a market is open and
    // every 15 minutes otherwise, re-evaluating the cadence after each cycle.
    const scheduleNext = () => {
      timerId = window.setTimeout(async () => {
        await refreshSnapshot();
        scheduleNext();
      }, getRefreshIntervalMs(new Date()));
    };

    void refreshSnapshot();
    scheduleNext();

    return () => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const allWatchItems = snapshot?.watchSections.flatMap((section) => section.items) ?? [];
  const selectedStock = allWatchItems.find((item) => item.symbol === selectedSymbol) ?? null;

  const filteredNews =
    snapshot?.newsFeed.filter(
      (item) => !selectedSymbol || item.affectedSymbols.includes(selectedSymbol)
    ) ?? [];

  const newsFeed = filteredNews.length > 0 ? filteredNews : (snapshot?.newsFeed ?? []);

  const filteredImpactChains =
    snapshot?.impactChains.filter((chain) => {
      if (!selectedSymbol) {
        return true;
      }

      if (chain.rootSymbols.includes(selectedSymbol)) {
        return true;
      }

      return chain.branches.some(
        (branch) =>
          branch.sourceSymbol === selectedSymbol ||
          branch.targets.includes(selectedSymbol)
      );
    }) ?? [];

  const impactChains =
    filteredImpactChains.length > 0 ? filteredImpactChains : (snapshot?.impactChains ?? []);

  return (
    <main className="dashboard-shell" data-color-mode={colorMode}>
      <div className="dashboard-frame">
        <HeaderBar
          colorMode={colorMode}
          isLoading={loading}
          lastUpdatedAt={snapshot?.lastUpdatedAt ?? null}
          onRefresh={() => {
            void refreshSnapshot(true);
          }}
          onColorModeChange={setColorMode}
          source={snapshot?.source ?? "mock"}
        />

        {errorMessage ? <div className="inline-alert">{errorMessage}</div> : null}

        <MarketStrip indicators={snapshot?.marketStrip ?? []} />

        <DailyBrief
          brief={snapshot?.dailyBrief ?? null}
          selectedSymbol={selectedStock?.symbol ?? null}
          selectedStockName={selectedStock?.name ?? null}
        />

        <section className="dashboard-main-grid">
          <WatchlistPanel
            sections={snapshot?.watchSections ?? []}
            selectedSymbol={selectedStock?.symbol ?? null}
            onSelectSymbol={(symbol) => {
              setSelectedSymbol((current) => (current === symbol ? null : symbol));
            }}
          />

          <NewsFeed
            items={newsFeed}
            selectedSymbol={selectedStock?.symbol ?? null}
            selectedStockName={selectedStock?.name ?? null}
          />
        </section>

        <ImpactMap
          chains={impactChains}
          selectedSymbol={selectedStock?.symbol ?? null}
          selectedStockName={selectedStock?.name ?? null}
        />

        <SchedulePanel brief={snapshot?.dailyBrief ?? null} />
      </div>
    </main>
  );
}

export default App;
