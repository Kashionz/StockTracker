import type { BriefSchedule } from "../types";

export interface LaunchdStartInterval {
  Hour: number;
  Minute: number;
}

export interface LaunchdPlistDefinition {
  label: string;
  outputDir: string;
  startIntervals: LaunchdStartInterval[];
  statePath: string;
  stdoutPath: string;
  stderrPath: string;
  workingDirectory: string;
  environment: Record<string, string>;
}

const launchdEnvironmentKeys = [
  "PATH",
  "HOME",
  "FINNHUB_API_KEY",
  "VITE_FINNHUB_API_KEY",
  "SINOPAC_BACKEND_URL",
  "VITE_SINOPAC_BASE_URL",
  "OPENAI_API_KEY",
  "BRIEF_WEBHOOK_URL",
  "BRIEF_WEBHOOK_FORMAT",
  "SLACK_WEBHOOK_URL",
  "FRED_API_KEY",
  "VITE_FRED_API_KEY",
  "FRED_BASE_URL",
  "VITE_FRED_BASE_URL",
  "SENTIMENT_API_URL",
  "VITE_SENTIMENT_API_URL",
  "SENTIMENT_MODEL",
  "VITE_SENTIMENT_MODEL",
  "TWSE_BASE_URL",
  "VITE_TWSE_BASE_URL",
  "TWSE_MIS_BASE_URL",
  "VITE_TWSE_MIS_BASE_URL",
  "GOOGLE_NEWS_BASE_URL",
  "VITE_GOOGLE_NEWS_BASE_URL"
] as const;

const stableSystemPathPrefixes = [
  "/opt/homebrew/bin",
  "/opt/homebrew/sbin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
  "/Library/Apple/usr/bin"
];

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function parseScheduleTime(time: string): LaunchdStartInterval | null {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return null;
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
    return null;
  }

  return {
    Hour: hours,
    Minute: minutes
  };
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function normalizeLaunchdPath(pathValue: string, homeDir?: string) {
  const stableUserPrefixes = homeDir
    ? [
        `${homeDir}/.nvm/versions/`,
        `${homeDir}/Library/pnpm`,
        `${homeDir}/.local/bin`
      ]
    : [];

  const filteredSegments = pathValue
    .split(":")
    .filter(Boolean)
    .filter(
      (segment) =>
        stableSystemPathPrefixes.includes(segment) ||
        stableUserPrefixes.some((prefix) => segment.startsWith(prefix))
    );

  return [...new Set(filteredSegments)].join(":");
}

export function buildLaunchdStartIntervals(
  schedules: BriefSchedule[]
): LaunchdStartInterval[] {
  return schedules
    .filter((schedule) => schedule.enabled)
    .map((schedule) => parseScheduleTime(schedule.time))
    .filter((interval): interval is LaunchdStartInterval => Boolean(interval))
    .sort((left, right) => {
      if (left.Hour !== right.Hour) {
        return left.Hour - right.Hour;
      }

      return left.Minute - right.Minute;
    });
}

export function pickLaunchdEnvironment(
  environment: Record<string, string | undefined>
): Record<string, string> {
  const homeDir = environment.HOME;

  return Object.fromEntries(
    launchdEnvironmentKeys
      .map((key) => {
        if (key === "PATH" && typeof environment.PATH === "string") {
          return [key, normalizeLaunchdPath(environment.PATH, homeDir)];
        }

        return [key, environment[key]];
      })
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
  );
}

export function buildLaunchdCommand(options: {
  workingDirectory: string;
  outputDir: string;
  statePath: string;
  notify?: boolean;
}) {
  const commandParts = [
    `cd ${shellQuote(options.workingDirectory)}`,
    `npm run brief:due -- --state ${shellQuote(options.statePath)} --output-dir ${shellQuote(options.outputDir)}${options.notify ? " --notify" : ""}`
  ];

  return commandParts.join(" && ");
}

function renderStartIntervals(startIntervals: LaunchdStartInterval[]) {
  if (startIntervals.length === 1) {
    const interval = startIntervals[0];

    return [
      "<dict>",
      "<key>Hour</key>",
      `<integer>${interval.Hour}</integer>`,
      "<key>Minute</key>",
      `<integer>${interval.Minute}</integer>`,
      "</dict>"
    ].join("");
  }

  return startIntervals
    .map(
      (interval) =>
        `<dict><key>Hour</key><integer>${interval.Hour}</integer><key>Minute</key><integer>${interval.Minute}</integer></dict>`
    )
    .join("");
}

function renderEnvironment(environment: Record<string, string>) {
  return Object.entries(environment)
    .map(
      ([key, value]) =>
        `<key>${escapeXml(key)}</key><string>${escapeXml(value)}</string>`
    )
    .join("");
}

export function buildLaunchdPlist(definition: LaunchdPlistDefinition) {
  const command = buildLaunchdCommand({
    workingDirectory: definition.workingDirectory,
    outputDir: definition.outputDir,
    statePath: definition.statePath,
    notify: true
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
<key>Label</key>
<string>${escapeXml(definition.label)}</string>
<key>WorkingDirectory</key>
<string>${escapeXml(definition.workingDirectory)}</string>
<key>ProgramArguments</key>
<array>
<string>/bin/zsh</string>
<string>-lc</string>
<string>${escapeXml(command)}</string>
</array>
<key>EnvironmentVariables</key>
<dict>${renderEnvironment(definition.environment)}</dict>
<key>StartCalendarInterval</key>
<array>${renderStartIntervals(definition.startIntervals)}</array>
<key>StandardOutPath</key>
<string>${escapeXml(definition.stdoutPath)}</string>
<key>StandardErrorPath</key>
<string>${escapeXml(definition.stderrPath)}</string>
<key>RunAtLoad</key>
<false/>
</dict>
</plist>`;
}
