import { describe, expect, it } from "vitest";
import {
  buildLaunchdCommand,
  buildLaunchdPlist,
  buildLaunchdStartIntervals,
  pickLaunchdEnvironment
} from "./launchd";

describe("launchd", () => {
  it("maps enabled schedules into start intervals", () => {
    expect(
      buildLaunchdStartIntervals([
        {
          id: "tw-pre",
          label: "台股開盤前",
          description: "",
          time: "08:30",
          enabled: true
        },
        {
          id: "tw-post",
          label: "台股收盤後",
          description: "",
          time: "15:05",
          enabled: true
        },
        {
          id: "us-post",
          label: "美股收盤後",
          description: "",
          time: "05:00",
          enabled: false
        }
      ])
    ).toEqual([
      { Hour: 8, Minute: 30 },
      { Hour: 15, Minute: 5 }
    ]);
  });

  it("keeps only launchd-safe environment variables", () => {
    expect(
      pickLaunchdEnvironment({
        PATH: "/opt/homebrew/bin:/usr/bin:/bin",
        HOME: "/Users/kashionz",
        OPENAI_API_KEY: "sk-test",
        FINNHUB_API_KEY: "finnhub-test",
        BRIEF_WEBHOOK_URL: "https://hooks.slack.com/services/test",
        BRIEF_WEBHOOK_FORMAT: "slack",
        FRED_API_KEY: "fred-test",
        SINOPAC_BACKEND_URL: "http://127.0.0.1:8001",
        CUSTOM_VAR: "ignore-me"
      })
    ).toEqual({
      BRIEF_WEBHOOK_FORMAT: "slack",
      BRIEF_WEBHOOK_URL: "https://hooks.slack.com/services/test",
      FINNHUB_API_KEY: "finnhub-test",
      FRED_API_KEY: "fred-test",
      SINOPAC_BACKEND_URL: "http://127.0.0.1:8001",
      HOME: "/Users/kashionz",
      OPENAI_API_KEY: "sk-test",
      PATH: "/opt/homebrew/bin:/usr/bin:/bin"
    });
  });

  it("sanitizes PATH to stable directories for launchd", () => {
    expect(
      pickLaunchdEnvironment({
        HOME: "/Users/kashionz",
        PATH: "/Users/kashionz/Desktop/StockTracker/node_modules/.bin:/Users/kashionz/.codex/tmp/arg0/codex-arg0XYZ:/Users/kashionz/.nvm/versions/node/v24.15.0/bin:/opt/homebrew/bin:/usr/bin:/bin"
      })
    ).toEqual({
      HOME: "/Users/kashionz",
      PATH: "/Users/kashionz/.nvm/versions/node/v24.15.0/bin:/opt/homebrew/bin:/usr/bin:/bin"
    });
  });

  it("builds a shell command for background due runs", () => {
    expect(
      buildLaunchdCommand({
        outputDir: "output/brief-runner",
        statePath: "output/brief-runner/state.json",
        workingDirectory: "/Users/kashionz/Desktop/StockTracker"
      })
    ).toContain("npm run brief:due -- --state 'output/brief-runner/state.json'");
  });

  it("builds a launchd plist with schedule times, env, and due command", () => {
    const plist = buildLaunchdPlist({
      label: "com.kashionz.stock-tracker-brief",
      outputDir: "output/brief-runner",
      startIntervals: [
        { Hour: 8, Minute: 30 },
        { Hour: 15, Minute: 5 }
      ],
      statePath: "output/brief-runner/state.json",
      stdoutPath: "/Users/kashionz/Desktop/StockTracker/output/brief-runner/launchd.stdout.log",
      stderrPath: "/Users/kashionz/Desktop/StockTracker/output/brief-runner/launchd.stderr.log",
      workingDirectory: "/Users/kashionz/Desktop/StockTracker",
      environment: {
        PATH: "/opt/homebrew/bin:/usr/bin:/bin",
        OPENAI_API_KEY: "sk-test"
      }
    });

    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain("<string>com.kashionz.stock-tracker-brief</string>");
    expect(plist).toContain("<key>StartCalendarInterval</key>");
    expect(plist).toContain("<key>Hour</key>");
    expect(plist).toContain("<integer>8</integer>");
    expect(plist).toContain("<integer>30</integer>");
    expect(plist).toContain("<key>OPENAI_API_KEY</key>");
    expect(plist).toContain("npm run brief:due");
    expect(plist).toContain("--notify");
  });
});
