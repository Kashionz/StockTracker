# 股市分析面板

依據 [股市分析面板_規劃文件.md](/Users/kashionz/Desktop/StockTracker/%E8%82%A1%E5%B8%82%E5%88%86%E6%9E%90%E9%9D%A2%E6%9D%BF_%E8%A6%8F%E5%8A%83%E6%96%87%E4%BB%B6.md) 建立的 React + Vite 單頁面板 MVP。

## 功能

- 大盤與總經指標帶
- 盤前／盤後摘要
- 摘要文字輸出 / 複製
- 排程設定與摘要歷史
- 到點桌面通知
- 本機背景摘要 runner
- 關注個股報價牆
- 新聞情緒動態流
- 個股影響映射
- 盤中自動更新：台股或美股任一開盤時每 1 分鐘更新，非盤中（休市、夜間、週末）降頻為每 15 分鐘
- 手動刷新
- 台股 / 國際漲跌配色切換
- Live source 失敗時自動退回 mock 資料

## 啟動

```bash
npm install --cache .npm-cache
npm run dev -- --host 127.0.0.1 --port 4173
```

## 建置與測試

```bash
npm run test -- --run
npm run build
```

若在不同作業系統間搬動 repo（例如 macOS 安裝完的 `node_modules` 帶到 WSL / Linux），`vitest` 或 `npm run build` 可能報 `Cannot find module @rollup/rollup-<平台>`。這是因為 `node_modules` 內只裝了原平台的 rollup native binary（npm optional deps 已知 bug）。`package-lock.json` 本身已涵蓋所有平台，重裝即可修復：

```bash
rm -rf node_modules
npm ci
# 或僅補當前平台：npm install
```

## 背景摘要輸出

除了前端頁面內的排程與桌面通知，現在也可以直接用本機 CLI runner 在頁面未開啟時產生摘要檔：

```bash
npm run brief:run
npm run brief:due
npm run brief:launchd:print
npm run brief:launchd:export
```

- `npm run brief:run`：立即產生一筆摘要，適合手動執行或除錯。
- `npm run brief:due`：只在排程到點時產生摘要，適合交給 `cron` / `launchd` 定時呼叫。
- `npm run brief:launchd:print`：印出目前背景排程對應的 macOS `launchd` plist。
- `npm run brief:launchd:export`：把 plist 匯出到 `output/brief-runner/launchd/`。
- `npm run brief:launchd:install`：安裝到 `~/Library/LaunchAgents/` 並載入。
- `npm run brief:launchd:uninstall`：卸載並移除 `launchd` agent。
- 預設輸出目錄是 `output/brief-runner/`。
- 最新摘要會寫到 `output/brief-runner/latest.txt` 與 `output/brief-runner/latest.json`。
- 歷史摘要會寫到 `output/brief-runner/history/`。
- runner 自己的排程與歷史 state 會寫到 `output/brief-runner/state.json`；若你要讓背景排程改時間或停用某時段，可以直接編輯這個檔案。
- `launchd` 背景模式會在到點時執行 `brief:due`，並嘗試送出 macOS 系統通知；若通知失敗，摘要檔仍會正常輸出。

若你要在背景排程時直接推送出去，可以設定 webhook：

```bash
BRIEF_WEBHOOK_URL=https://你的-webhook
BRIEF_WEBHOOK_FORMAT=json
```

若使用 Slack incoming webhook，也可直接指定：

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

這種情況下 runner 會自動用 Slack `text` payload 推送摘要。

## Live 資料

目前支援三條 live provider：

- `Finnhub`：覆蓋部分美股即時資料與公司新聞（免費方案不含指數）
- `Yahoo Finance`：補 S&P 500／Nasdaq／SOX／VIX 美股指數（Finnhub 免費方案無法取得）
- `Fugle`（可選）：覆蓋台股 watchlist 的付費即時報價
- `TWSE OpenAPI + MIS`：覆蓋 watchlist 內台股盤後資料、同日盤中延遲報價、加權指數與重大訊息
- `FRED`（可選）：補 `USD/TWD` 與 `US10Y` 的每日總經數據
- `Google News RSS`：補台股中文新聞搜尋結果，並映射到 watchlist 個股
- `OpenAI Responses API`（可選）：補中文與無分數新聞的 AI 情緒判讀

`Finnhub` 使用方式（建議）：本機開發模式會預設透過 Vite proxy 走 `/api/finnhub`，把 shell 內的 `FINNHUB_API_KEY` 以 `X-Finnhub-Token` header 注入，不會把 key 打進前端 bundle：

```bash
FINNHUB_API_KEY=你的_key npm run dev
```

若部署到其他環境，請提供自己的同源 proxy，再指定：

```bash
VITE_FINNHUB_BASE_URL=https://你的代理/finnhub
```

（不建議）若仍要讓瀏覽器直接呼叫 Finnhub，可改用 `VITE_FINNHUB_API_KEY`，但這會把 key 內嵌進前端 bundle：

```bash
VITE_FINNHUB_API_KEY=你的_key npm run dev
```

TWSE 在本機開發模式會預設透過 Vite proxy 走 `/api/twse`，避免瀏覽器 CORS 擋下官方端點；若你部署到其他環境，需要提供同等的反向代理，或直接指定：

```bash
VITE_TWSE_BASE_URL=https://你的代理/v1 npm run dev
```

若你要讓台股 watchlist 改用 Fugle 付費即時報價，本機開發模式可直接借用 Vite proxy，把 shell 內的 `FUGLE_API_KEY` 轉成同源 `/api/fugle` 呼叫，不會把 key 打進前端 bundle：

```bash
FUGLE_API_KEY=你的_key npm run dev
```

若你部署到其他環境，請提供自己的同源 proxy 或後端轉發，再指定：

```bash
VITE_FUGLE_BASE_URL=https://你的代理/fugle
```

若要讓台股同日盤中延遲報價生效，還需要提供 MIS 代理；本機開發模式會預設透過 `/api/twse-mis`，若你部署到其他環境可直接指定：

```bash
VITE_TWSE_MIS_BASE_URL=https://你的代理 npm run dev
```

Google News RSS 在本機開發模式會預設透過 Vite proxy 走 `/api/google-news`；若你部署到其他環境，也需要提供同等的反向代理，或直接指定：

```bash
VITE_GOOGLE_NEWS_BASE_URL=https://你的代理 npm run dev
```

若要讓 `USD/TWD` 與 `US10Y` 也改用 live 總經資料，可提供 FRED API key；本機開發模式會預設透過 `/api/fred` 代理：

```bash
VITE_FRED_API_KEY=你的_key npm run dev
```

若你部署到其他環境，也可直接指定：

```bash
VITE_FRED_BASE_URL=https://你的代理
VITE_FRED_API_KEY=你的_key
```

AI 情緒判讀在本機開發模式可直接借用 Vite proxy，把 shell 內的 `OPENAI_API_KEY` 轉成同源 `/api/ai-sentiment` 呼叫，不會把 key 打進前端 bundle：

```bash
OPENAI_API_KEY=你的_key npm run dev
```

若你部署到其他環境，請提供自己的同源 sentiment proxy，並指定：

```bash
VITE_SENTIMENT_API_URL=https://你的代理/sentiment
VITE_SENTIMENT_MODEL=gpt-5-mini
```

若 live 抓取失敗，或部署環境沒有可用的台股代理，畫面會自動退回內建 mock 資料，面板仍可正常操作。

## 目前限制

- 台股目前可用 MIS 顯示同日盤中延遲資料，但不是真正逐筆即時；若要盤中即時，仍需富果或券商 API。
- 部署到靜態站時，TWSE OpenAPI、TWSE MIS、Google News RSS、Yahoo Finance 與 AI sentiment proxy 都需要額外的同源 proxy，否則瀏覽器無法直接讀官方端點。
- Finnhub 目前只覆蓋美股 watchlist 與部分新聞，不是全量多市場即時源；免費方案不含指數，S&P／Nasdaq／SOX／VIX 改由 Yahoo Finance 補足。
- 背景摘要目前已補上 macOS `launchd` 與 webhook 推送；但 LINE 等其他特定平台仍未做專屬格式整合。
- 供應鏈傳導仍有一部分屬規則式映射，非投資建議。
