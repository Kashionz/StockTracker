"""SinoPac (Shioaji) realtime market-data backend.

Logs into Shioaji once at startup and exposes a small same-origin-friendly REST
surface the StockTracker frontend polls via the Vite `/api/sinopac` proxy:

    GET /health                       -> login / contract readiness
    GET /snapshots?symbols=&indices=  -> { updatedAt, quotes[], indices[] }

The frontend only ever talks to this service; the api_key / secret_key never
leave the server. Shioaji covers Taiwan markets only (TSE/OTC stocks, TAIFEX,
indices) — US data stays on Finnhub/Yahoo in the frontend.
"""

import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.concurrency import run_in_threadpool

try:  # auto-load server/.env so it works cross-platform without shell exports
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover
    pass

try:  # shioaji is optional at import time so the service still boots without it
    import shioaji as sj
except Exception:  # pragma: no cover
    sj = None

API_KEY = os.environ.get("SINOPAC_API_KEY", "")
SECRET_KEY = os.environ.get("SINOPAC_SECRET_KEY", "")
SIMULATION = os.environ.get("SINOPAC_SIMULATION", "true").lower() in ("1", "true", "yes")
CACHE_TTL_SECONDS = float(os.environ.get("SINOPAC_CACHE_TTL", "2"))

state = {"api": None, "ready": False, "error": None}
_cache: dict[str, tuple[float, dict]] = {}


def _login():
    if sj is None:
        raise RuntimeError("shioaji is not installed")
    if not API_KEY or not SECRET_KEY:
        raise RuntimeError("SINOPAC_API_KEY / SINOPAC_SECRET_KEY not set")
    api = sj.Shioaji(simulation=SIMULATION)
    # contracts_timeout makes login wait until contract definitions are downloaded.
    api.login(api_key=API_KEY, secret_key=SECRET_KEY, contracts_timeout=10000)
    return api


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        state["api"] = await run_in_threadpool(_login)
        state["ready"] = True
    except Exception as exc:  # keep the server up; /health reports not ready
        state["error"] = str(exc)
        state["ready"] = False
    yield
    api = state.get("api")
    if api is not None:
        try:
            await run_in_threadpool(api.logout)
        except Exception:
            pass


app = FastAPI(title="StockTracker SinoPac backend", lifespan=lifespan)


def _ts_to_iso(ts) -> Optional[str]:
    if not ts:
        return None
    try:  # Shioaji snapshot.ts is nanoseconds since epoch
        return datetime.fromtimestamp(int(ts) / 1_000_000_000, tz=timezone.utc).isoformat()
    except Exception:
        return None


def _resolve_contracts(api, stock_codes, index_codes):
    resolved = []
    for code in stock_codes:
        try:
            contract = api.Contracts.Stocks[code]
        except Exception:
            contract = None
        if contract is not None:
            resolved.append(("stock", code, contract))
    for code in index_codes:
        try:
            contract = api.Contracts.Indexs.TSE[code]
        except Exception:
            contract = None
        if contract is not None:
            resolved.append(("index", code, contract))
    return resolved


def _snapshot_payload(api, stock_codes, index_codes) -> dict:
    resolved = _resolve_contracts(api, stock_codes, index_codes)
    if not resolved:
        return {"quotes": [], "indices": []}

    snaps = api.snapshots([contract for _, _, contract in resolved])
    by_code = {getattr(snap, "code", None): snap for snap in snaps}

    quotes, indices = [], []
    for kind, code, _ in resolved:
        snap = by_code.get(code)
        if snap is None:
            continue
        item = {
            "code": code,
            "close": getattr(snap, "close", None),
            "change_rate": getattr(snap, "change_rate", None),
            "total_volume": getattr(snap, "total_volume", None),
            "ts": _ts_to_iso(getattr(snap, "ts", None)),
        }
        (indices if kind == "index" else quotes).append(item)
    return {"quotes": quotes, "indices": indices}


@app.get("/health")
def health():
    return {"ready": state["ready"], "simulation": SIMULATION, "error": state["error"]}


@app.get("/snapshots")
async def snapshots(symbols: str = Query(""), indices: str = Query("")):
    now = datetime.now(timezone.utc).isoformat()

    if not state["ready"] or state["api"] is None:
        return {"updatedAt": now, "quotes": [], "indices": []}

    stock_codes = [code for code in symbols.split(",") if code]
    index_codes = [code for code in indices.split(",") if code]

    cache_key = f"{','.join(stock_codes)}|{','.join(index_codes)}"
    cached = _cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return {"updatedAt": now, **cached[1]}

    try:
        data = await run_in_threadpool(
            _snapshot_payload, state["api"], stock_codes, index_codes
        )
    except Exception:
        # Return empty so the frontend's runProvider falls back to TWSE EOD / mock.
        data = {"quotes": [], "indices": []}

    _cache[cache_key] = (time.monotonic(), data)
    return {"updatedAt": now, **data}
