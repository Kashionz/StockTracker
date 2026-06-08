# Background Scheduler Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 補齊股市分析面板在頁面未開啟時的本機背景自動摘要能力，讓每日排程摘要可透過 macOS `launchd` 自動執行。

**Architecture:** 以既有 `brief-runner` CLI 為核心，不新增後端。新增一層純函式 `launchd` 生成模組負責把排程 state 轉成 plist，再由獨立腳本負責 print/export/install/uninstall；CLI runner 額外支援背景通知，讓 `launchd` 執行不只寫檔，也能提醒使用者。

**Tech Stack:** TypeScript、Vitest、Vite Node、macOS launchd、Node.js fs/process/child_process

---

### Task 1: 建立 launchd 純函式與測試

**Files:**
- Create: `src/lib/launchd.ts`
- Create: `src/lib/launchd.test.ts`

- [ ] **Step 1: 先寫失敗測試，描述 enabled schedules 會轉成 launchd 時段**

```ts
expect(buildLaunchdStartIntervals([
  { id: "tw-pre", label: "", description: "", time: "08:30", enabled: true },
  { id: "tw-post", label: "", description: "", time: "15:05", enabled: true },
  { id: "us-post", label: "", description: "", time: "05:00", enabled: false }
])).toEqual([
  { Hour: 8, Minute: 30 },
  { Hour: 15, Minute: 5 }
]);
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- --run src/lib/launchd.test.ts`
Expected: FAIL，因為 `launchd.ts` 尚不存在

- [ ] **Step 3: 實作 plist 生成與環境變數過濾**

```ts
export function buildLaunchdPlist(definition: LaunchdDefinition) {
  return `<?xml version="1.0" encoding="UTF-8"?>...`;
}
```

- [ ] **Step 4: 重跑 launchd 單元測試**

Run: `npm run test -- --run src/lib/launchd.test.ts`
Expected: PASS

### Task 2: 接上背景排程 CLI 與通知

**Files:**
- Modify: `scripts/brief-runner.mjs`
- Create: `scripts/brief-launchd.mjs`
- Modify: `package.json`

- [ ] **Step 1: 先寫失敗測試，描述背景 runner 會輸出對應排程檔**

```ts
expect(result.files.some((file) => file.path.endsWith("latest.txt"))).toBe(true);
```

- [ ] **Step 2: 跑相關測試確認現況**

Run: `npm run test -- --run src/lib/briefRunnerJob.test.ts`
Expected: PASS，作為回歸基線

- [ ] **Step 3: 在 `brief-runner.mjs` 加上 `--notify` 支援，並建立 `brief-launchd.mjs`**

```js
if (args.notify && result.generatedEntries.length > 0) {
  await notifyEntries(result.generatedEntries);
}
```

- [ ] **Step 4: 新增 package scripts**

```json
"brief:launchd:print": "vite-node scripts/brief-launchd.mjs print",
"brief:launchd:export": "vite-node scripts/brief-launchd.mjs export",
"brief:launchd:install": "vite-node scripts/brief-launchd.mjs install",
"brief:launchd:uninstall": "vite-node scripts/brief-launchd.mjs uninstall"
```

### Task 3: 文件與 dry-run 驗證

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README 的背景排程說明**

```md
- `npm run brief:launchd:export`：匯出 plist 到工作目錄
- `npm run brief:launchd:install`：安裝到 `~/Library/LaunchAgents`
```

- [ ] **Step 2: 跑完整測試**

Run: `npm run test -- --run`
Expected: PASS

- [ ] **Step 3: 跑 production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: 做不碰系統目錄的 dry-run 驗證**

Run: `npm run brief:launchd:print`
Expected: stdout 含 `StartCalendarInterval` 與 `brief:due`

Run: `npm run brief:launchd:export`
Expected: 在 `output/brief-runner/launchd/` 看到 plist
