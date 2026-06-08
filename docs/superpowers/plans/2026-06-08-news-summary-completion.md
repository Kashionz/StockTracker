# Stock Dashboard News And Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 補齊台股中文消息面與盤前／盤後摘要，讓股市分析面板更接近規劃文件的完整互動版本。

**Architecture:** 延伸既有 `DashboardPayload -> DashboardSnapshot` 流程，不額外引入後端。TWSE 重大訊息先在 `api.ts` 轉為 `RawNewsItem`，再由 `marketTransformer.ts` 產生可讀的摘要資料；React 畫面只負責呈現與互動，不承擔資料推論。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、TWSE OpenAPI、既有 mock/live loader

---

### Task 1: 整合台股官方重大訊息到新聞流

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/api.test.ts`
- Modify: `README.md`

- [ ] **Step 1: 先寫失敗測試，描述 TWSE 重大訊息應轉成新聞卡**

```ts
expect(payload?.news.some((item) => item.id.startsWith("twse-2330-"))).toBe(true);
expect(payload?.news.find((item) => item.id.startsWith("twse-2330-"))).toMatchObject({
  source: "TWSE 重大訊息",
  symbols: expect.arrayContaining(["2330"])
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- --run src/lib/api.test.ts`
Expected: FAIL，因為 `api.ts` 尚未把重大訊息併入 `news`

- [ ] **Step 3: 在 `api.ts` 新增 TWSE 重大訊息 provider**

```ts
const twseNewsRows = await fetchJson<TwseAnnouncementResponse[]>(
  buildTwseUrl(twseBaseUrl, "opendata/t187ap04_L"),
  fetchImpl
);

payload.news = [
  ...mapTwseAnnouncements(twseNewsRows),
  ...payload.news
]
  .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
  .slice(0, 12);
```

- [ ] **Step 4: 重跑單元測試**

Run: `npm run test -- --run src/lib/api.test.ts`
Expected: PASS

- [ ] **Step 5: 更新 README 的 live provider 說明**

```md
- `TWSE OpenAPI`：覆蓋台股盤後報價、加權指數與重大訊息
```


### Task 2: 新增盤前／盤後摘要資料模型

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/marketTransformer.ts`
- Modify: `src/lib/marketTransformer.test.ts`

- [ ] **Step 1: 先寫失敗測試，描述摘要的 session、headline、bullets**

```ts
expect(snapshot.dailyBrief.sessionLabel).toBe("台股盤後摘要");
expect(snapshot.dailyBrief.bullets.length).toBeGreaterThanOrEqual(3);
expect(snapshot.dailyBrief.focusSymbols).toContain("2330");
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- --run src/lib/marketTransformer.test.ts`
Expected: FAIL，因為 `DashboardSnapshot` 尚未包含 `dailyBrief`

- [ ] **Step 3: 在 transformer 生成摘要**

```ts
dailyBrief: buildDailyBrief({
  lastUpdatedAt: payload.lastUpdatedAt,
  newsFeed,
  watchSections,
  marketStrip
})
```

- [ ] **Step 4: 重跑摘要相關測試**

Run: `npm run test -- --run src/lib/marketTransformer.test.ts`
Expected: PASS


### Task 3: 把摘要面板接到首頁版面

**Files:**
- Create: `src/components/DailyBrief.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: 先寫失敗測試，描述摘要面板會出現在首頁**

```ts
expect(screen.getByText("盤前／盤後摘要")).toBeInTheDocument();
expect(screen.getByText(/台股盤後摘要|台股盤前摘要|盤中追蹤/)).toBeInTheDocument();
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- --run src/App.test.tsx`
Expected: FAIL，因為畫面尚未渲染摘要模組

- [ ] **Step 3: 新增摘要面板元件並接入 `App.tsx`**

```tsx
<DailyBrief
  brief={snapshot?.dailyBrief ?? null}
  selectedSymbol={selectedStock?.symbol ?? null}
/>
```

- [ ] **Step 4: 為摘要面板補樣式**

```css
.brief-panel {
  margin-top: 18px;
}

.brief-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
}
```

- [ ] **Step 5: 重跑首頁測試**

Run: `npm run test -- --run src/App.test.tsx`
Expected: PASS


### Task 4: 全量驗證

**Files:**
- Verify only

- [ ] **Step 1: 跑完整測試**

Run: `npm run test -- --run`
Expected: PASS

- [ ] **Step 2: 跑 production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: 起本機頁面並檢查桌機 / 手機畫面**

Run: `npm run dev -- --host 127.0.0.1 --port 4173`
Expected: 看到重大訊息與摘要面板，且無明顯 console error

- [ ] **Step 4: 關閉本機開發伺服器**

Run: `pkill -f 'vite --host 127.0.0.1 --port 4173'`
Expected: process 結束
