import { composeDailyBriefText } from "./briefComposer";
import { compareDateTimeDesc } from "./dateTime";
import type { BriefHistoryEntry, BriefSchedule, DailyBrief } from "../types";

const scheduleStorageKey = "stock-tracker-dashboard:brief-schedules";
const historyStorageKey = "stock-tracker-dashboard:brief-history";
const notificationPreferenceStorageKey = "stock-tracker-dashboard:brief-notification-enabled";
const maxHistoryEntries = 12;

export const defaultBriefSchedules: BriefSchedule[] = [
  {
    id: "tw-pre",
    label: "台股開盤前",
    description: "預設在 08:30 產生盤前摘要。",
    time: "08:30",
    enabled: true
  },
  {
    id: "tw-post",
    label: "台股收盤後",
    description: "預設在 15:05 整理盤後重點。",
    time: "15:05",
    enabled: true
  },
  {
    id: "us-post",
    label: "美股收盤後",
    description: "預設在 05:00 產出隔日觀察摘要。",
    time: "05:00",
    enabled: false
  }
];

function getStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage;
  }

  return typeof window === "undefined" ? null : window.localStorage;
}

function normalizeTime(time: string, fallback: string): string {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return fallback;
  }

  const [hours, minutes] = time.split(":").map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return fallback;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildScheduledDate(time: string, now: Date): Date {
  const [hours, minutes] = normalizeTime(time, "09:00").split(":").map(Number);
  const scheduledAt = new Date(now);

  scheduledAt.setHours(hours, minutes, 0, 0);

  return scheduledAt;
}

export function resolveBriefScheduleDate(time: string, now = new Date()): Date {
  return buildScheduledDate(time, now);
}

function coerceSchedule(schedule: Partial<BriefSchedule>, fallback: BriefSchedule): BriefSchedule {
  return {
    id: fallback.id,
    label: fallback.label,
    description: fallback.description,
    time: normalizeTime(schedule.time ?? fallback.time, fallback.time),
    enabled: typeof schedule.enabled === "boolean" ? schedule.enabled : fallback.enabled
  };
}

export function loadBriefSchedules(storage?: Storage): BriefSchedule[] {
  const targetStorage = getStorage(storage);

  if (!targetStorage) {
    return defaultBriefSchedules;
  }

  try {
    const rawValue = targetStorage.getItem(scheduleStorageKey);

    if (!rawValue) {
      return defaultBriefSchedules;
    }

    const parsedValue = JSON.parse(rawValue) as Array<Partial<BriefSchedule>>;

    return defaultBriefSchedules.map((fallback) =>
      coerceSchedule(parsedValue.find((schedule) => schedule.id === fallback.id) ?? {}, fallback)
    );
  } catch {
    return defaultBriefSchedules;
  }
}

export function saveBriefSchedules(schedules: BriefSchedule[], storage?: Storage) {
  const targetStorage = getStorage(storage);

  targetStorage?.setItem(scheduleStorageKey, JSON.stringify(schedules));
}

export function loadBriefHistory(storage?: Storage): BriefHistoryEntry[] {
  const targetStorage = getStorage(storage);

  if (!targetStorage) {
    return [];
  }

  try {
    const rawValue = targetStorage.getItem(historyStorageKey);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as BriefHistoryEntry[];

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

export function saveBriefHistory(history: BriefHistoryEntry[], storage?: Storage) {
  const targetStorage = getStorage(storage);

  targetStorage?.setItem(historyStorageKey, JSON.stringify(history));
}

export function loadBriefNotificationPreference(storage?: Storage): boolean {
  const targetStorage = getStorage(storage);

  if (!targetStorage) {
    return false;
  }

  try {
    return JSON.parse(targetStorage.getItem(notificationPreferenceStorageKey) ?? "false") === true;
  } catch {
    return false;
  }
}

export function saveBriefNotificationPreference(enabled: boolean, storage?: Storage) {
  const targetStorage = getStorage(storage);

  targetStorage?.setItem(notificationPreferenceStorageKey, JSON.stringify(enabled));
}

export function getNextRunAt(schedule: BriefSchedule, now = new Date()): string {
  const nextRunAt = resolveBriefScheduleDate(schedule.time, now);

  if (nextRunAt.getTime() <= now.getTime()) {
    nextRunAt.setDate(nextRunAt.getDate() + 1);
  }

  return nextRunAt.toISOString();
}

export function isBriefScheduleDue(
  schedule: BriefSchedule,
  history: BriefHistoryEntry[],
  now = new Date()
): boolean {
  if (!schedule.enabled) {
    return false;
  }

  const scheduledAt = buildScheduledDate(schedule.time, now);

  if (now.getTime() < scheduledAt.getTime()) {
    return false;
  }

  return !history.some((entry) => {
    if (entry.scheduleId !== schedule.id) {
      return false;
    }

    const createdAt = new Date(entry.createdAt).getTime();
    const windowEnd = scheduledAt.getTime() + 1000 * 60 * 60 * 24;

    return createdAt >= scheduledAt.getTime() && createdAt < windowEnd;
  });
}

export function buildBriefHistoryEntry(
  brief: DailyBrief,
  options: {
    scheduleId?: BriefHistoryEntry["scheduleId"];
    label?: string;
    now?: Date;
  } = {}
): BriefHistoryEntry {
  const createdAt = options.now ?? new Date();

  return {
    id: `${options.scheduleId ?? "manual"}-${createdAt.getTime()}`,
    scheduleId: options.scheduleId ?? "manual",
    label: options.label ?? "手動建立",
    headline: brief.headline,
    text: composeDailyBriefText(brief),
    createdAt: createdAt.toISOString(),
    sentiment: brief.sentiment,
    focusSymbols: brief.focusSymbols
  };
}

export function appendBriefHistory(
  history: BriefHistoryEntry[],
  nextEntries: BriefHistoryEntry[]
): BriefHistoryEntry[] {
  return [...nextEntries, ...history]
    .sort((left, right) => compareDateTimeDesc(left.createdAt, right.createdAt))
    .slice(0, maxHistoryEntries);
}
