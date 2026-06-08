import {
  appendBriefHistory,
  buildBriefHistoryEntry,
  defaultBriefSchedules,
  isBriefScheduleDue,
  resolveBriefScheduleDate
} from "./briefSchedule";
import type { BriefHistoryEntry, BriefSchedule, DailyBrief } from "../types";

export interface BriefRunnerState {
  schedules: BriefSchedule[];
  history: BriefHistoryEntry[];
}

function mergeSchedules(schedules?: BriefSchedule[]): BriefSchedule[] {
  return defaultBriefSchedules.map((fallback) => {
    const current = schedules?.find((schedule) => schedule.id === fallback.id);

    return current
      ? {
          ...fallback,
          ...current
        }
      : fallback;
  });
}

export function resolveBriefRunnerState(
  state?: Partial<BriefRunnerState> | null
): BriefRunnerState {
  return {
    schedules: mergeSchedules(state?.schedules),
    history: Array.isArray(state?.history) ? state.history : []
  };
}

export function createImmediateRunnerEntry(
  brief: DailyBrief,
  now = new Date()
): BriefHistoryEntry {
  return buildBriefHistoryEntry(brief, {
    scheduleId: "manual",
    label: "手動建立",
    now
  });
}

export function createDueRunnerEntries(
  brief: DailyBrief,
  state: BriefRunnerState,
  now = new Date()
): BriefHistoryEntry[] {
  return state.schedules
    .filter((schedule) => isBriefScheduleDue(schedule, state.history, now))
    .map((schedule) =>
      buildBriefHistoryEntry(brief, {
        scheduleId: schedule.id,
        label: schedule.label,
        now: resolveBriefScheduleDate(schedule.time, now)
      })
    );
}

export function applyRunnerEntries(
  state: BriefRunnerState,
  entries: BriefHistoryEntry[]
): BriefRunnerState {
  if (entries.length === 0) {
    return state;
  }

  return {
    ...state,
    history: appendBriefHistory(state.history, entries)
  };
}
