import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { resolveBriefRunnerState } from "../src/lib/briefRunner.ts";
import {
  buildLaunchdPlist,
  buildLaunchdStartIntervals,
  pickLaunchdEnvironment
} from "../src/lib/launchd.ts";

const execFileAsync = promisify(execFile);
const defaultLabel = "com.kashionz.stock-tracker-brief";
const defaultOutputDir = "output/brief-runner";

function parseArgs(argv) {
  const parsed = {
    action: "print",
    label: defaultLabel,
    outputDir: defaultOutputDir,
    exportPath: "",
    statePath: path.join(defaultOutputDir, "state.json")
  };

  const [firstArg] = argv;

  if (firstArg && !firstArg.startsWith("--")) {
    parsed.action = firstArg;
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--label" && next) {
      parsed.label = next;
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

    if (current === "--export-path" && next) {
      parsed.exportPath = next;
      index += 1;
      continue;
    }

    if (current === "--help") {
      parsed.help = true;
    }
  }

  return parsed;
}

async function readJsonFile(filePath) {
  try {
    const rawValue = await readFile(filePath, "utf8");

    return JSON.parse(rawValue);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeTextFile(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function resolvePlistPath(label) {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
}

function buildDefinition(args, schedules) {
  const workingDirectory = process.cwd();
  const startIntervals = buildLaunchdStartIntervals(schedules);

  if (startIntervals.length === 0) {
    throw new Error("目前沒有啟用中的摘要排程，無法建立 launchd plist。");
  }

  return {
    label: args.label,
    outputDir: args.outputDir,
    statePath: args.statePath,
    startIntervals,
    stdoutPath: path.join(workingDirectory, args.outputDir, "launchd.stdout.log"),
    stderrPath: path.join(workingDirectory, args.outputDir, "launchd.stderr.log"),
    workingDirectory,
    environment: pickLaunchdEnvironment(process.env)
  };
}

async function loadSchedules(statePath) {
  const state = resolveBriefRunnerState(await readJsonFile(statePath));

  return state.schedules;
}

async function installAgent(plistPath) {
  try {
    await execFileAsync("launchctl", ["unload", plistPath]);
  } catch {
    // Ignore: first install or agent not loaded yet.
  }

  await execFileAsync("launchctl", ["load", plistPath]);
}

async function uninstallAgent(plistPath) {
  try {
    await execFileAsync("launchctl", ["unload", plistPath]);
  } catch {
    // Ignore: agent may already be unloaded.
  }

  await rm(plistPath, { force: true });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      [
        "Usage: vite-node scripts/brief-launchd.mjs [print|export|install|uninstall] [--state path] [--output-dir path] [--label value]",
        "",
        "print    顯示目前 launchd plist",
        "export   匯出 plist 到工作目錄",
        "install  安裝到 ~/Library/LaunchAgents 並載入",
        "uninstall 從 ~/Library/LaunchAgents 移除並卸載"
      ].join("\n")
    );
    return;
  }

  if (args.action === "uninstall") {
    const plistPath = resolvePlistPath(args.label);

    await uninstallAgent(plistPath);
    console.log(`已移除 launchd agent：${plistPath}`);
    return;
  }

  const schedules = await loadSchedules(args.statePath);
  const definition = buildDefinition(args, schedules);
  const plist = buildLaunchdPlist(definition);

  if (args.action === "print") {
    console.log(plist);
    return;
  }

  if (args.action === "export") {
    const exportPath =
      args.exportPath || path.join(args.outputDir, "launchd", `${args.label}.plist`);

    await writeTextFile(exportPath, plist);
    console.log(`已匯出 launchd plist：${exportPath}`);
    return;
  }

  if (args.action === "install") {
    const plistPath = resolvePlistPath(args.label);

    await writeTextFile(plistPath, plist);
    await installAgent(plistPath);
    console.log(`已安裝 launchd agent：${plistPath}`);
    return;
  }

  throw new Error(`未知 action：${args.action}`);
}

await main();
