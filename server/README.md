# SinoPac (Shioaji) backend

Serves realtime Taiwan market data to the StockTracker frontend. The frontend
polls `GET /snapshots` through the Vite `/api/sinopac` proxy; the SinoPac
`api_key` / `secret_key` stay here and are never shipped to the browser.

> Shioaji covers **Taiwan markets only** (TSE/OTC stocks, TAIFEX, indices).
> US stocks/indices stay on Finnhub/Yahoo in the frontend.

## Setup

```bash
cd server
cp .env.example .env   # fill in SINOPAC_API_KEY / SINOPAC_SECRET_KEY
uv sync                # installs shioaji, fastapi, uvicorn, python-dotenv
uv run uvicorn main:app --port 8001
```

`server/.env` is auto-loaded (via python-dotenv), so no manual `export` /
`set` is needed — this works the same on Windows (PowerShell/cmd) and Unix.

Then start the frontend (`npm run dev`) — TW stocks + TAIEX will use SinoPac
realtime via `/api/sinopac`.

## Endpoints

- `GET /health` → `{ ready, simulation, error }`. `ready=false` means login
  failed (missing creds / shioaji); the frontend then falls back to TWSE EOD.
- `GET /snapshots?symbols=2330,2454&indices=001` →
  ```json
  { "updatedAt": "<ISO>",
    "quotes":  [ { "code": "2330", "close": 1180.0, "change_rate": 1.72, "total_volume": 23145, "ts": "<ISO>" } ],
    "indices": [ { "code": "001",  "close": 24010.5, "change_rate": -0.42, "ts": "<ISO>" } ] }
  ```
  `001` = TAIEX weighted index (`Contracts.Indexs.TSE["001"]`).

## Notes / limits

- One login = one connection; SinoPac allows max 5 connections per person_id.
- Snapshots accept up to 500 contracts per call; the watchlist needs ~10.
- If the feed is rate-limited it returns empty values — the service then returns
  empty arrays and the frontend keeps the TWSE EOD / mock fallback.
- Long-running, stateful (persistent login) → deploy as a always-on service,
  **not** serverless. See the repo root README "Production 部署" section.
