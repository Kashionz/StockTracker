# Stock Dashboard MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個可直接開啟的單頁股市分析面板 MVP，包含大盤總經指標、關注個股報價牆、新聞情緒動態流與消息影響映射。

**Architecture:** 採用 React + Vite + TypeScript 建立純前端單頁應用。資料層分為靜態設定、正規化轉換與面板彙整三層，先以可測試的 mock/fallback 資料完成體驗，再預留 Finnhub 與台股來源串接點。

**Tech Stack:** React 19、Vite 7、TypeScript 5、Vitest、Testing Library、原生 CSS 變數設計系統

---

### Task 1: 建立專案骨架與工具鏈

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: 建立 Vite React TypeScript 專案檔**

建立最小可執行的 React + Vite 專案，並加入 `dev`、`build`、`test` 指令。

- [ ] **Step 2: 啟動基礎畫面**

先放入最小版 `App` 與全域樣式，確認本機能完成建置。

- [ ] **Step 3: 執行建置驗證**

Run: `npm run build`
Expected: Vite build 成功，產出 `dist/`

### Task 2: 以 TDD 建立設定與資料正規化邏輯

**Files:**
- Create: `src/types.ts`
- Create: `src/data/watchlists.ts`
- Create: `src/data/relationships.ts`
- Create: `src/data/mockPayload.ts`
- Create: `src/lib/marketTransformer.ts`
- Create: `src/lib/marketTransformer.test.ts`

- [ ] **Step 1: 先寫失敗測試**

驗證三件事：
1. 原始報價可轉為面板卡片資料
2. 新聞情緒可映射為利多/利空/中性
3. 消息能依供應鏈關聯推得受影響個股

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm run test -- --run src/lib/marketTransformer.test.ts`
Expected: 因模組尚未實作而失敗

- [ ] **Step 3: 實作最小資料模型與轉換邏輯**

新增型別、預設關注清單、供應鏈映射表、mock payload 與轉換函式。

- [ ] **Step 4: 再跑測試確認通過**

Run: `npm run test -- --run src/lib/marketTransformer.test.ts`
Expected: 測試通過

### Task 3: 建立面板 UI 與互動

**Files:**
- Create: `src/components/HeaderBar.tsx`
- Create: `src/components/MarketStrip.tsx`
- Create: `src/components/WatchlistPanel.tsx`
- Create: `src/components/NewsFeed.tsx`
- Create: `src/components/ImpactMap.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: 依概念稿建立設計 token 與版面容器**

建立色彩、間距、字級與響應式斷點，先完成整體框架。

- [ ] **Step 2: 完成四個模組元件**

實作頂部狀態列、大盤總經指標帶、報價牆、新聞流與影響映射。

- [ ] **Step 3: 加入互動**

支援：
1. 手動刷新
2. 漲跌配色切換
3. 點選個股後篩出相關新聞

- [ ] **Step 4: 執行測試與建置**

Run: `npm run test -- --run`
Expected: 全部單元測試通過

Run: `npm run build`
Expected: 建置成功

### Task 4: 補上資料服務層與 fallback 策略

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/lib/dashboardLoader.ts`
- Create: `src/lib/dashboardLoader.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 先寫失敗測試**

驗證在沒有 API key 或請求失敗時，會回退到本地 mock 資料；有資料時會正規化成畫面所需格式。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm run test -- --run src/lib/dashboardLoader.test.ts`
Expected: 因 loader 尚未實作而失敗

- [ ] **Step 3: 實作資料抓取與 fallback**

建立可選的 Finnhub/TWSE fetcher 介面，並於失敗時自動退回 mock。

- [ ] **Step 4: 再跑測試確認通過**

Run: `npm run test -- --run src/lib/dashboardLoader.test.ts`
Expected: 測試通過

### Task 5: 最終驗證與交付整理

**Files:**
- Modify: `docs/superpowers/plans/2026-06-07-stock-dashboard-mvp.md`
- Optional Create: `README.md`

- [ ] **Step 1: 啟動本機畫面驗證**

Run: `npm run dev -- --host 0.0.0.0`
Expected: 本機可開啟面板

- [ ] **Step 2: 執行完整驗證**

Run: `npm run test -- --run && npm run build`
Expected: 測試與建置皆成功

- [ ] **Step 3: 進行視覺驗證**

使用瀏覽器檢查桌機與手機版面，確認與概念稿在資訊階層、色彩、主要區塊與互動上對齊。
