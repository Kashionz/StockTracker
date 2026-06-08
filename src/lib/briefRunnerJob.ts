import type { BriefHistoryEntry, DashboardSnapshot } from "../types";
import {
  applyRunnerEntries,
  createDueRunnerEntries,
  createImmediateRunnerEntry,
  resolveBriefRunnerState,
  type BriefRunnerState
} from "./briefRunner";

export interface BriefRunnerJobFile {
  path: string;
  content: string;
}

export interface BriefRunnerJobOptions {
  mode?: "once" | "due";
  outputDir?: string;
  now?: Date;
  loadSnapshot: () => Promise<DashboardSnapshot>;
  readState?: () => Promise<Partial<BriefRunnerState> | null | undefined>;
  saveState?: (state: BriefRunnerState) => Promise<void> | void;
  writeTextFile?: (path: string, content: string) => Promise<void> | void;
}

export interface BriefRunnerJobResult {
  mode: "once" | "due";
  snapshotSource: DashboardSnapshot["source"];
  generatedEntries: BriefHistoryEntry[];
  state: BriefRunnerState;
  files: BriefRunnerJobFile[];
}

const defaultOutputDir = "output/brief-runner";

function formatRunnerFileTimestamp(value: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

function buildRunnerFiles(
  entries: BriefHistoryEntry[],
  snapshot: DashboardSnapshot,
  outputDir: string
): BriefRunnerJobFile[] {
  if (entries.length === 0) {
    return [];
  }

  const latestEntry = entries[entries.length - 1];
  const historyFiles = entries.map((entry) => ({
    path: `${outputDir}/history/${formatRunnerFileTimestamp(entry.createdAt)}-${entry.scheduleId}.txt`,
    content: entry.text
  }));

  return [
    {
      path: `${outputDir}/latest.txt`,
      content: latestEntry.text
    },
    {
      path: `${outputDir}/latest.json`,
      content: JSON.stringify(
        {
          scheduleId: latestEntry.scheduleId,
          label: latestEntry.label,
          headline: latestEntry.headline,
          createdAt: latestEntry.createdAt,
          sentiment: latestEntry.sentiment,
          focusSymbols: latestEntry.focusSymbols,
          source: snapshot.source,
          text: latestEntry.text
        },
        null,
        2
      )
    },
    ...historyFiles
  ];
}

export async function runBriefRunnerJob(
  options: BriefRunnerJobOptions
): Promise<BriefRunnerJobResult> {
  const mode = options.mode ?? "once";
  const now = options.now ?? new Date();
  const outputDir = options.outputDir ?? defaultOutputDir;
  const state = resolveBriefRunnerState((await options.readState?.()) ?? null);
  const snapshot = await options.loadSnapshot();
  const generatedEntries =
    mode === "due"
      ? createDueRunnerEntries(snapshot.dailyBrief, state, now)
      : [createImmediateRunnerEntry(snapshot.dailyBrief, now)];
  const nextState = applyRunnerEntries(state, generatedEntries);
  const files = buildRunnerFiles(generatedEntries, snapshot, outputDir);

  await options.saveState?.(nextState);

  for (const file of files) {
    await options.writeTextFile?.(file.path, file.content);
  }

  return {
    mode,
    snapshotSource: snapshot.source,
    generatedEntries,
    state: nextState,
    files
  };
}
