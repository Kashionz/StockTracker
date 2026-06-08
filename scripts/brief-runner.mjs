import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { loadDashboardSnapshot } from "../src/lib/dashboardLoader.ts";
import { loadLiveDashboardPayload } from "../src/lib/api.ts";
import { deliverBriefEntries } from "../src/lib/briefDelivery.ts";
import { runBriefRunnerJob } from "../src/lib/briefRunnerJob.ts";

const defaultOutputDir = "output/brief-runner";
const openAiResponsesUrl = "https://api.openai.com/v1/responses";
const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const parsed = {
    mode: "once",
    outputDir: defaultOutputDir,
    statePath: path.join(defaultOutputDir, "state.json")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--mode" && (next === "once" || next === "due")) {
      parsed.mode = next;
      index += 1;
      continue;
    }

    if (current === "--output-dir" && next) {
      parsed.outputDir = next;
      parsed.statePath = path.join(next, "state.json");
      index += 1;
      continue;
    }

    if (current === "--state" && next) {
      parsed.statePath = next;
      index += 1;
      continue;
    }

    if (current === "--help") {
      parsed.help = true;
    }

    if (current === "--notify") {
      parsed.notify = true;
    }

    if (current === "--webhook-url" && next) {
      parsed.webhookUrl = next;
      index += 1;
      continue;
    }

    if (current === "--webhook-format" && (next === "json" || next === "slack")) {
      parsed.webhookFormat = next;
      index += 1;
    }
  }

  return parsed;
}

function createRunnerFetch(openAiApiKey) {
  return async function runnerFetch(input, init) {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;

    if (openAiApiKey && url === openAiResponsesUrl) {
      const headers = new Headers(init?.headers ?? {});

      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${openAiApiKey}`);
      }

      return fetch(input, {
        ...init,
        headers
      });
    }

    return fetch(input, init);
  };
}

async function readJsonFile(filePath) {
  try {
    const rawValue = await readFile(filePath, "utf8");

    return JSON.parse(rawValue);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }

    console.warn(`略過無法解析的 runner state：${filePath}`);
    return null;
  }
}

async function writeTextFile(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function escapeAppleScriptString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function notifyEntries(entries) {
  const latestEntry = entries[entries.length - 1];

  if (!latestEntry) {
    return;
  }

  const title = "股市分析面板";
  const body =
    entries.length === 1
      ? `${latestEntry.label} 已更新：${latestEntry.headline}`
      : `${entries.length} 筆排程摘要已更新，最新是 ${latestEntry.label}`;

  try {
    await execFileAsync("osascript", [
      "-e",
      `display notification "${escapeAppleScriptString(body)}" with title "${escapeAppleScriptString(title)}"`
    ]);
  } catch {
    console.warn("背景通知未成功送出，摘要檔仍已更新。");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      [
        "Usage: vite-node scripts/brief-runner.mjs [--mode once|due] [--output-dir path] [--state path]",
        "",
        "預設輸出：output/brief-runner",
        "state 檔預設：output/brief-runner/state.json"
      ].join("\n")
    );
    return;
  }

  const openAiApiKey = process.env.OPENAI_API_KEY ?? "";
  const fetchImpl = createRunnerFetch(openAiApiKey);
  const finnhubApiKey = process.env.FINNHUB_API_KEY ?? process.env.VITE_FINNHUB_API_KEY ?? "";
  const fugleApiKey = process.env.FUGLE_API_KEY ?? process.env.VITE_FUGLE_API_KEY ?? "";
  const fugleBaseUrl =
    process.env.FUGLE_BASE_URL ??
    process.env.VITE_FUGLE_BASE_URL ??
    (fugleApiKey ? "https://api.fugle.tw/marketdata/v1.0/stock" : "");
  const twseBaseUrl = process.env.TWSE_BASE_URL ?? process.env.VITE_TWSE_BASE_URL ?? "https://openapi.twse.com.tw/v1";
  const twseMisBaseUrl =
    process.env.TWSE_MIS_BASE_URL ?? process.env.VITE_TWSE_MIS_BASE_URL ?? "https://mis.twse.com.tw";
  const googleNewsBaseUrl =
    process.env.GOOGLE_NEWS_BASE_URL ?? process.env.VITE_GOOGLE_NEWS_BASE_URL ?? "https://news.google.com";
  const sentimentApiUrl =
    process.env.SENTIMENT_API_URL ??
    process.env.VITE_SENTIMENT_API_URL ??
    (openAiApiKey ? openAiResponsesUrl : "");
  const sentimentModel =
    process.env.SENTIMENT_MODEL ?? process.env.VITE_SENTIMENT_MODEL ?? "gpt-5-mini";
  const fredApiKey = process.env.FRED_API_KEY ?? process.env.VITE_FRED_API_KEY ?? "";
  const fredBaseUrl = process.env.FRED_BASE_URL ?? process.env.VITE_FRED_BASE_URL ?? "";
  const webhookUrl = args.webhookUrl ?? process.env.BRIEF_WEBHOOK_URL ?? process.env.SLACK_WEBHOOK_URL ?? "";
  const webhookFormat =
    args.webhookFormat ??
    process.env.BRIEF_WEBHOOK_FORMAT ??
    (process.env.SLACK_WEBHOOK_URL ? "slack" : "json");

  const result = await runBriefRunnerJob({
    mode: args.mode,
    outputDir: args.outputDir,
    loadSnapshot: () =>
      loadDashboardSnapshot({
        force: true,
        loadLivePayload: () =>
          loadLiveDashboardPayload({
            fetchImpl,
            finnhubApiKey,
            fugleApiKey,
            fugleBaseUrl,
            twseBaseUrl,
            twseMisBaseUrl,
            googleNewsBaseUrl,
            sentimentApiUrl,
            sentimentModel,
            fredApiKey,
            fredBaseUrl
          })
      }),
    readState: () => readJsonFile(args.statePath),
    saveState: async (state) => {
      await writeTextFile(args.statePath, JSON.stringify(state, null, 2));
    },
    writeTextFile
  });

  if (result.generatedEntries.length === 0) {
    console.log(`沒有到點排程，state 已同步到 ${args.statePath}`);
    return;
  }

  if (webhookUrl) {
    try {
      await deliverBriefEntries(result.generatedEntries, {
        webhookUrl,
        fetchImpl,
        format: webhookFormat,
        source: result.snapshotSource
      });
    } catch (error) {
      console.warn(
        error instanceof Error
          ? `Webhook 推送失敗：${error.message}`
          : "Webhook 推送失敗，但摘要檔仍已更新。"
      );
    }
  }

  if (args.notify) {
    await notifyEntries(result.generatedEntries);
  }

  console.log(
    [
      `已產生 ${result.generatedEntries.length} 筆摘要`,
      `資料來源：${result.snapshotSource}`,
      `最新輸出：${path.join(args.outputDir, "latest.txt")}`,
      `state：${args.statePath}`
    ].join("\n")
  );
}

await main();
