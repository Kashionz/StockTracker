import { describe, expect, it, vi } from "vitest";
import type { DashboardSnapshot } from "../types";
import { runBriefRunnerJob } from "./briefRunnerJob";

const sampleSnapshot: DashboardSnapshot = {
  source: "live",
  lastUpdatedAt: "2026-06-08T15:10:00+08:00",
  marketStrip: [],
  watchSections: [],
  dailyBrief: {
    sessionLabel: "台股盤後摘要",
    headline: "台積電盤後重點",
    bullets: ["TAIEX 收高。"],
    focusSymbols: ["2330", "2454"],
    sentiment: "bullish",
    updatedAt: "2026-06-08T15:10:00+08:00"
  },
  newsFeed: [],
  impactChains: []
};

describe("briefRunnerJob", () => {
  it("writes latest and history artifacts in once mode", async () => {
    const saveState = vi.fn(async () => undefined);
    const writeTextFile = vi.fn(async () => undefined);

    const result = await runBriefRunnerJob({
      loadSnapshot: async () => sampleSnapshot,
      saveState,
      writeTextFile,
      now: new Date("2026-06-08T15:20:00+08:00")
    });

    expect(result.mode).toBe("once");
    expect(result.generatedEntries).toHaveLength(1);
    expect(result.generatedEntries[0]).toMatchObject({
      scheduleId: "manual",
      headline: "台積電盤後重點"
    });
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(writeTextFile).toHaveBeenCalledTimes(3);
    expect(writeTextFile).toHaveBeenCalledWith(
      "output/brief-runner/latest.txt",
      expect.stringContaining("台股盤後摘要｜台積電盤後重點")
    );
    expect(writeTextFile).toHaveBeenCalledWith(
      "output/brief-runner/latest.json",
      expect.stringContaining("\"scheduleId\": \"manual\"")
    );
    expect(writeTextFile).toHaveBeenCalledWith(
      "output/brief-runner/history/20260608-152000-manual.txt",
      expect.stringContaining("關注焦點：2330、2454")
    );
  });

  it("skips artifact writes when no schedule is due", async () => {
    const saveState = vi.fn(async () => undefined);
    const writeTextFile = vi.fn(async () => undefined);

    const result = await runBriefRunnerJob({
      mode: "due",
      loadSnapshot: async () => sampleSnapshot,
      saveState,
      writeTextFile,
      now: new Date("2026-06-08T08:00:00+08:00")
    });

    expect(result.mode).toBe("due");
    expect(result.generatedEntries).toHaveLength(0);
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it("writes only due scheduled output and keeps state history ordered", async () => {
    const saveState = vi.fn(async () => undefined);
    const writeTextFile = vi.fn(async () => undefined);

    const result = await runBriefRunnerJob({
      mode: "due",
      loadSnapshot: async () => sampleSnapshot,
      readState: async () => ({
        history: [
          {
            id: "tw-pre-1",
            scheduleId: "tw-pre",
            label: "台股開盤前",
            headline: "早盤",
            text: "早盤",
            createdAt: "2026-06-08T08:35:00+08:00",
            sentiment: "neutral",
            focusSymbols: ["2330"]
          }
        ]
      }),
      saveState,
      writeTextFile,
      now: new Date("2026-06-08T15:10:00+08:00")
    });

    expect(result.generatedEntries).toHaveLength(1);
    expect(result.generatedEntries[0]).toMatchObject({
      scheduleId: "tw-post",
      label: "台股收盤後"
    });
    expect(result.state.history[0].scheduleId).toBe("tw-post");
    expect(result.state.history[1].scheduleId).toBe("tw-pre");
    expect(writeTextFile).toHaveBeenCalledWith(
      "output/brief-runner/history/20260608-150500-tw-post.txt",
      expect.stringContaining("台積電盤後重點")
    );
  });
});
