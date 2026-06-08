import { describe, expect, it } from "vitest";
import {
  applyRunnerEntries,
  createDueRunnerEntries,
  createImmediateRunnerEntry,
  resolveBriefRunnerState
} from "./briefRunner";

const sampleBrief = {
  sessionLabel: "台股盤後摘要",
  headline: "台積電盤後重點",
  bullets: ["TAIEX 收高。"],
  focusSymbols: ["2330", "2454"],
  sentiment: "bullish" as const,
  updatedAt: "2026-06-08T15:10:00+08:00"
};

describe("briefRunner", () => {
  it("fills missing schedules with defaults", () => {
    const state = resolveBriefRunnerState({
      schedules: [
        {
          id: "tw-post",
          label: "台股收盤後",
          description: "自訂",
          time: "15:10",
          enabled: false
        }
      ]
    });

    expect(state.schedules).toHaveLength(3);
    expect(state.schedules.find((schedule) => schedule.id === "tw-post")).toMatchObject({
      time: "15:10",
      enabled: false
    });
    expect(state.schedules.find((schedule) => schedule.id === "tw-pre")).toBeDefined();
  });

  it("creates only due schedule entries", () => {
    const state = resolveBriefRunnerState({
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
    });

    const entries = createDueRunnerEntries(
      sampleBrief,
      state,
      new Date("2026-06-08T15:10:00+08:00")
    );

    expect(entries.map((entry) => entry.scheduleId)).toEqual(["tw-post"]);
    expect(entries[0]).toMatchObject({
      label: "台股收盤後",
      headline: "台積電盤後重點"
    });
  });

  it("appends and sorts runner history entries", () => {
    const state = resolveBriefRunnerState({
      history: [
        {
          id: "old",
          scheduleId: "manual",
          label: "手動建立",
          headline: "舊摘要",
          text: "舊摘要",
          createdAt: "2026-06-08T08:00:00+08:00",
          sentiment: "neutral",
          focusSymbols: ["2330"]
        }
      ]
    });
    const nextEntry = createImmediateRunnerEntry(
      sampleBrief,
      new Date("2026-06-08T15:20:00+08:00")
    );

    const nextState = applyRunnerEntries(state, [nextEntry]);

    expect(nextState.history[0].headline).toBe("台積電盤後重點");
    expect(nextState.history[1].headline).toBe("舊摘要");
  });

  it("uses each schedule time when backfilling multiple due entries", () => {
    const state = resolveBriefRunnerState();

    const entries = createDueRunnerEntries(
      sampleBrief,
      state,
      new Date("2026-06-08T15:10:00+08:00")
    );
    const nextState = applyRunnerEntries(state, entries);

    expect(entries.map((entry) => entry.scheduleId)).toEqual(["tw-pre", "tw-post"]);
    expect(nextState.history[0].scheduleId).toBe("tw-post");
    expect(nextState.history[1].scheduleId).toBe("tw-pre");
  });
});
