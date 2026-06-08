import { describe, expect, it, vi } from "vitest";
import { loadLiveDashboardPayload } from "./api";
import { buildDashboardSnapshot } from "./marketTransformer";

describe("api", () => {
  it("returns null when no live provider is configured", async () => {
    const payload = await loadLiveDashboardPayload({
      finnhubApiKey: "",
      twseBaseUrl: ""
    });

    expect(payload).toBeNull();
  });

  it("merges TWSE delayed quotes and index data into the dashboard payload", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T00:30:00+08:00"));
    try {
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/exchangeReport/STOCK_DAY_ALL")) {
          return new Response(
            JSON.stringify([
              {
                Date: "1150605",
                Code: "2330",
                Name: "台積電",
                TradeVolume: "147780",
                TradeValue: "0",
                OpeningPrice: "2395.0000",
                HighestPrice: "2405.0000",
                LowestPrice: "2350.0000",
                ClosingPrice: "2365.0000",
                Change: "-20.0000",
                Transaction: "32568"
              },
              {
                Date: "1150605",
                Code: "2454",
                Name: "聯發科",
                TradeVolume: "11775",
                TradeValue: "0",
                OpeningPrice: "4360.0000",
                HighestPrice: "4430.0000",
                LowestPrice: "4130.0000",
                ClosingPrice: "4300.0000",
                Change: "-130.0000",
                Transaction: "10656"
              }
            ]),
            { status: 200 }
          );
        }

        if (url.endsWith("/exchangeReport/MI_INDEX")) {
          return new Response(
            JSON.stringify([
              {
                日期: "1150605",
                指數: "發行量加權股價指數",
                收盤指數: "45070.94",
                漲跌: "-",
                漲跌點數: "606.52",
                漲跌百分比: "-1.33",
                特殊處理註記: ""
              }
            ]),
            { status: 200 }
          );
        }

        if (url.endsWith("/opendata/t187ap04_L")) {
          return new Response(
            JSON.stringify([
              {
                出表日期: "1150607",
                發言日期: "1150606",
                發言時間: "211800",
                公司代號: "2330",
                公司名稱: "台積電",
                "主旨 ": "台積電先進封裝需求續強，供應鏈備產",
                符合條款: "第51款",
                事實發生日: "1150606",
                說明:
                  "CoWoS 產能擴張進度穩定，封測與伺服器族群情緒偏多，客戶拉貨動能延續。"
              }
            ]),
            { status: 200 }
          );
        }

        return new Response("not found", { status: 404 });
      }) as typeof fetch;

      const payload = await loadLiveDashboardPayload({
        fetchImpl,
        finnhubApiKey: "",
        twseBaseUrl: "https://proxy.example.com/v1"
      });

      expect(fetchImpl).toHaveBeenCalledTimes(3);
      expect(payload).not.toBeNull();
      expect(payload?.lastUpdatedAt).toBe("2026-06-07T16:30:00.000Z");
      expect(payload?.quotes.find((quote) => quote.symbol === "2330")).toMatchObject({
        price: 2365,
        changePct: -0.84,
        volume: 147780,
        delayTag: "官方盤後",
        updatedAt: "2026-06-05T13:30:00+08:00"
      });
      expect(payload?.quotes.find((quote) => quote.symbol === "2454")).toMatchObject({
        price: 4300,
        changePct: -2.93,
        volume: 11775,
        delayTag: "官方盤後"
      });
      expect(payload?.macros.find((macro) => macro.key === "taiex")).toMatchObject({
        value: "45,070.94",
        changePct: -1.33,
        delayTag: "官方盤後",
        updatedAt: "2026-06-05T13:30:00+08:00"
      });
      expect(payload?.news.some((item) => item.id.startsWith("twse-2330-1150606-211800"))).toBe(true);
      expect(payload?.news.find((item) => item.id.startsWith("twse-2330-1150606-211800"))).toMatchObject({
        source: "TWSE 重大訊息",
        symbols: expect.arrayContaining(["2330"])
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("merges Chinese RSS news into the dashboard payload", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/rss/search?")) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
          <rss version="2.0">
            <channel>
              <title>Google News</title>
              <item>
                <title>台積電擴大 CoWoS 產能，廣達與緯創同步備戰 - 經濟日報</title>
                <link>https://news.google.com/articles/test-1</link>
                <pubDate>Sun, 07 Jun 2026 12:00:00 GMT</pubDate>
                <description>&lt;a href="https://news.google.com/articles/test-1"&gt;台積電擴大 CoWoS 產能，廣達與緯創同步備戰&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;經濟日報&lt;/font&gt;</description>
                <source url="https://money.udn.com">經濟日報</source>
              </item>
            </channel>
          </rss>`,
          {
            status: 200,
            headers: {
              "Content-Type": "application/rss+xml"
            }
          }
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const payload = await loadLiveDashboardPayload({
      fetchImpl,
      finnhubApiKey: "",
      twseBaseUrl: "",
      googleNewsBaseUrl: "https://proxy.example.com"
    } as never);

    expect(payload).not.toBeNull();
    expect(payload?.news[0]).toMatchObject({
      title: "台積電擴大 CoWoS 產能，廣達與緯創同步備戰",
      source: "經濟日報",
      symbols: expect.arrayContaining(["2330", "2382", "3231"])
    });
  });

  it("prefers same-day TWSE MIS quotes and index during the trading session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T10:15:00+08:00"));

    try {
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/exchangeReport/STOCK_DAY_ALL")) {
          return new Response(
            JSON.stringify([
              {
                Date: "1150605",
                Code: "2330",
                Name: "台積電",
                TradeVolume: "147780",
                TradeValue: "0",
                OpeningPrice: "2395.0000",
                HighestPrice: "2405.0000",
                LowestPrice: "2350.0000",
                ClosingPrice: "2365.0000",
                Change: "-20.0000",
                Transaction: "32568"
              }
            ]),
            { status: 200 }
          );
        }

        if (url.endsWith("/exchangeReport/MI_INDEX")) {
          return new Response(
            JSON.stringify([
              {
                日期: "1150605",
                指數: "發行量加權股價指數",
                收盤指數: "45070.94",
                漲跌: "-",
                漲跌點數: "606.52",
                漲跌百分比: "-1.33",
                特殊處理註記: ""
              }
            ]),
            { status: 200 }
          );
        }

        if (url.endsWith("/opendata/t187ap04_L")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }

        if (url.includes("/stock/api/getStockInfo.jsp?")) {
          return new Response(
            JSON.stringify({
              msgArray: [
                {
                  c: "2330",
                  n: "台積電",
                  z: "2410.0000",
                  y: "2385.0000",
                  ov: "182345",
                  tlong: "1780884900000",
                  d: "20260608",
                  t: "10:15:00",
                  ex: "tse"
                },
                {
                  c: "t00",
                  n: "發行量加權股價指數",
                  z: "45210.35",
                  y: "45070.94",
                  tlong: "1780884900000",
                  d: "20260608",
                  t: "10:15:00",
                  ex: "tse"
                }
              ],
              queryTime: {
                sysDate: "20260608",
                sysTime: "10:15:02"
              },
              rtcode: "0000"
            }),
            { status: 200 }
          );
        }

        return new Response("not found", { status: 404 });
      }) as typeof fetch;

      const payload = await loadLiveDashboardPayload({
        fetchImpl,
        finnhubApiKey: "",
        twseBaseUrl: "https://proxy.example.com/v1",
        twseMisBaseUrl: "https://proxy.example.com"
      });

      expect(payload).not.toBeNull();
      expect(payload?.quotes.find((quote) => quote.symbol === "2330")).toMatchObject({
        price: 2410,
        changePct: 1.05,
        volume: 182345,
        delayTag: "盤中延遲",
        updatedAt: "2026-06-08T02:15:00.000Z"
      });
      expect(payload?.macros.find((macro) => macro.key === "taiex")).toMatchObject({
        value: "45,210.35",
        changePct: 0.31,
        delayTag: "盤中延遲",
        updatedAt: "2026-06-08T02:15:00.000Z"
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses AI sentiment classification when a sentiment provider is configured", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/rss/search?")) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
          <rss version="2.0">
            <channel>
              <item>
                <title>台積電法說重點整理 - 經濟日報</title>
                <link>https://news.google.com/articles/test-ai-1</link>
                <pubDate>Sun, 07 Jun 2026 12:00:00 GMT</pubDate>
                <description>&lt;a href="https://news.google.com/articles/test-ai-1"&gt;台積電法說重點整理&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;經濟日報&lt;/font&gt;</description>
                <source url="https://money.udn.com">經濟日報</source>
              </item>
            </channel>
          </rss>`,
          {
            status: 200,
            headers: {
              "Content-Type": "application/rss+xml"
            }
          }
        );
      }

      if (url.includes("/ai-sentiment")) {
        return new Response(
          JSON.stringify({
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      items: [
                        {
                          id: "google-news-1780833600000-0",
                          sentiment: "bearish",
                          confidence: 0.88
                        }
                      ]
                    })
                  }
                ]
              }
            ]
          }),
          { status: 200 }
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const payload = await loadLiveDashboardPayload({
      fetchImpl,
      finnhubApiKey: "",
      twseBaseUrl: "",
      googleNewsBaseUrl: "https://proxy.example.com",
      sentimentApiUrl: "https://proxy.example.com/ai-sentiment"
    } as never);

    expect(payload).not.toBeNull();
    expect(payload?.news[0]).toMatchObject({
      sentimentScore: -0.88
    });

    const snapshot = buildDashboardSnapshot(payload!, "live");

    expect(snapshot.newsFeed[0]).toMatchObject({
      sentiment: "bearish"
    });
  });

  it("fetches Finnhub company news for the full US watchlist", async () => {
    const seenNewsSymbols: string[] = [];

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/quote")) {
        return new Response(
          JSON.stringify({
            c: 100,
            pc: 98,
            t: 1780833600
          }),
          { status: 200 }
        );
      }

      if (url.pathname.endsWith("/company-news")) {
        const symbol = url.searchParams.get("symbol") ?? "UNKNOWN";

        seenNewsSymbols.push(symbol);

        return new Response(
          JSON.stringify([
            {
              headline: `${symbol} outlook update`,
              summary: `${symbol} summary`,
              source: "Finnhub",
              datetime: 1780833600,
              related: symbol
            }
          ]),
          { status: 200 }
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const payload = await loadLiveDashboardPayload({
      fetchImpl,
      finnhubApiKey: "demo-key",
      twseBaseUrl: "",
      googleNewsBaseUrl: ""
    });

    expect(payload).not.toBeNull();
    expect(seenNewsSymbols.sort()).toEqual([
      "AAPL",
      "AMD",
      "AVGO",
      "GOOGL",
      "MSFT",
      "NVDA",
      "TSLA"
    ]);
    expect(payload?.news.some((item) => item.symbols.includes("TSLA"))).toBe(true);
    expect(payload?.news.some((item) => item.symbols.includes("AVGO"))).toBe(true);
  });

  it("merges live macro indicators from Finnhub and FRED when configured", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T09:00:00+08:00"));

    try {
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname.endsWith("/quote")) {
          const symbol = url.searchParams.get("symbol") ?? "";

          if (symbol === "^GSPC") {
            return new Response(JSON.stringify({ c: 5342.18, pc: 5300.04, t: 1780869600 }), { status: 200 });
          }

          if (symbol === "^IXIC") {
            return new Response(JSON.stringify({ c: 18011.22, pc: 17910.11, t: 1780869600 }), { status: 200 });
          }

          if (symbol === "^SOX") {
            return new Response(JSON.stringify({ c: 5288.42, pc: 5230.15, t: 1780869600 }), { status: 200 });
          }

          if (symbol === "^VIX") {
            return new Response(JSON.stringify({ c: 13.82, pc: 14.3, t: 1780869600 }), { status: 200 });
          }

          return new Response(JSON.stringify({ c: 100, pc: 98, t: 1780869600 }), { status: 200 });
        }

        if (url.pathname.endsWith("/company-news")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }

        if (url.pathname.endsWith("/fred/series/observations")) {
          const seriesId = url.searchParams.get("series_id");

          if (seriesId === "DEXTAUS") {
            return new Response(
              JSON.stringify({
                observations: [
                  { date: "2026-06-04", value: "32.21" },
                  { date: "2026-06-05", value: "32.18" }
                ]
              }),
              { status: 200 }
            );
          }

          if (seriesId === "DGS10") {
            return new Response(
              JSON.stringify({
                observations: [
                  { date: "2026-06-03", value: "4.49" },
                  { date: "2026-06-04", value: "4.47" }
                ]
              }),
              { status: 200 }
            );
          }
        }

        return new Response("not found", { status: 404 });
      }) as typeof fetch;

      const payload = await loadLiveDashboardPayload({
        fetchImpl,
        finnhubApiKey: "demo-key",
        twseBaseUrl: "",
        googleNewsBaseUrl: "",
        fredApiKey: "fred-demo",
        fredBaseUrl: "https://fred-proxy.example.com"
      } as never);

      expect(payload).not.toBeNull();
      expect(payload?.macros.find((macro) => macro.key === "spx")).toMatchObject({
        value: "5,342.18",
        changePct: 0.8,
        delayTag: "即時"
      });
      expect(payload?.macros.find((macro) => macro.key === "ixic")).toMatchObject({
        value: "18,011.22",
        delayTag: "即時"
      });
      expect(payload?.macros.find((macro) => macro.key === "sox")).toMatchObject({
        value: "5,288.42",
        delayTag: "即時"
      });
      expect(payload?.macros.find((macro) => macro.key === "vix")).toMatchObject({
        value: "13.82",
        delayTag: "即時"
      });
      expect(payload?.macros.find((macro) => macro.key === "usd-twd")).toMatchObject({
        value: "32.18",
        delayTag: "每日",
        updatedAt: "2026-06-05T00:00:00.000Z"
      });
      expect(payload?.macros.find((macro) => macro.key === "us10y")).toMatchObject({
        value: "4.47%",
        delayTag: "每日",
        updatedAt: "2026-06-04T00:00:00.000Z"
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("merges Fugle realtime quotes for Taiwan watchlist symbols when configured", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/intraday/quote/2330")) {
        expect(init?.headers).toMatchObject({
          "X-API-KEY": "fugle-demo"
        });

        return new Response(
          JSON.stringify({
            symbol: "2330",
            name: "台積電",
            previousClose: 915,
            lastPrice: 922,
            closePrice: 922,
            changePercent: 0.77,
            total: {
              tradeVolume: 182345
            },
            isClose: false,
            lastUpdated: 1780869600000000
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/intraday/quote/2454")) {
        return new Response(
          JSON.stringify({
            symbol: "2454",
            name: "聯發科",
            previousClose: 1275,
            lastPrice: 1291,
            closePrice: 1291,
            changePercent: 1.25,
            total: {
              tradeVolume: 11775
            },
            isClose: false,
            lastUpdated: 1780869600000000
          }),
          { status: 200 }
        );
      }

      if (/\/intraday\/quote\/(2317|2303|2308|2382|3231|3711)$/.test(url)) {
        return new Response(
          JSON.stringify({
            lastPrice: 100,
            closePrice: 100,
            previousClose: 100,
            changePercent: 0,
            total: {
              tradeVolume: 1
            },
            isClose: false,
            lastUpdated: 1780869600000000
          }),
          { status: 200 }
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const payload = await loadLiveDashboardPayload({
      fetchImpl,
      finnhubApiKey: "",
      twseBaseUrl: "",
      twseMisBaseUrl: "",
      googleNewsBaseUrl: "",
      fugleApiKey: "fugle-demo",
      fugleBaseUrl: "https://api.fugle.tw/marketdata/v1.0/stock"
    } as never);

    expect(payload).not.toBeNull();
    expect(payload?.quotes.find((quote) => quote.symbol === "2330")).toMatchObject({
      price: 922,
      changePct: 0.77,
      volume: 182345,
      delayTag: "即時",
      updatedAt: "2026-06-07T22:00:00.000Z"
    });
    expect(payload?.quotes.find((quote) => quote.symbol === "2454")).toMatchObject({
      price: 1291,
      changePct: 1.25,
      volume: 11775,
      delayTag: "即時"
    });
  });
});
