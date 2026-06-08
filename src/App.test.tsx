import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { mockDashboardPayload } from "./data/mockPayload";
import { buildDashboardSnapshot } from "./lib/marketTransformer";

const loadDashboardSnapshot = vi.fn();

vi.mock("./lib/dashboardLoader", () => ({
  loadDashboardSnapshot: () => loadDashboardSnapshot()
}));

describe("App", () => {
  beforeEach(() => {
    loadDashboardSnapshot.mockReset();
    window.localStorage.clear();
  });

  it("renders dashboard sections from loaded snapshot", async () => {
    loadDashboardSnapshot.mockResolvedValue(buildDashboardSnapshot(mockDashboardPayload, "mock"));

    render(<App />);

    expect(await screen.findByText("股市分析面板")).toBeInTheDocument();
    expect(screen.getByText("大盤與總經")).toBeInTheDocument();
    expect(await screen.findByText("盤前／盤後摘要")).toBeInTheDocument();
    expect(screen.getByText("關注個股")).toBeInTheDocument();
    expect(screen.getByText("新聞情緒")).toBeInTheDocument();
    expect(screen.getByText("個股影響映射")).toBeInTheDocument();
    expect(screen.getByText("排程與摘要紀錄")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "手動刷新" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "立即產生摘要" })).toBeInTheDocument();
    expect(screen.getAllByText(/台股盤中追蹤|台股盤前摘要|台股盤後摘要/).length).toBeGreaterThan(0);
  });

  it("filters news by selected symbol and refreshes on demand", async () => {
    loadDashboardSnapshot.mockResolvedValue(buildDashboardSnapshot(mockDashboardPayload, "mock"));

    render(<App />);

    const initialMatches = await screen.findAllByText("NVIDIA 財測上修，AI 伺服器需求持續強勁");
    expect(initialMatches.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "2330 台積電" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "2330 台積電" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.getAllByText("台積電先進封裝需求續強，供應鏈備產").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("聯準會官員重申利率將視通膨數據而定")).toHaveLength(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "手動刷新" }));

    await waitFor(() => {
      expect(loadDashboardSnapshot).toHaveBeenCalledTimes(2);
    });

    await screen.findByRole("button", { name: "手動刷新" });
  });

  it("creates a brief history entry from the manual schedule action", async () => {
    loadDashboardSnapshot.mockResolvedValue(buildDashboardSnapshot(mockDashboardPayload, "mock"));

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "立即產生摘要" }));

    expect((await screen.findAllByText("手動建立")).length).toBeGreaterThan(0);
  });

  it("creates today's scheduled brief history when a due window is already passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T15:10:00+08:00"));

    try {
      loadDashboardSnapshot.mockResolvedValue(buildDashboardSnapshot(mockDashboardPayload, "mock"));

      render(<App />);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getAllByText("自動排程").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
