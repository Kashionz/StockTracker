import { describe, expect, it, vi } from "vitest";
import { cleanEnv, loadLiveDashboardPayload } from "./api";
import { buildDashboardSnapshot } from "./marketTransformer";

describe("cleanEnv", () => {
  it("treats blank env overrides as unset so dev proxy defaults can apply", () => {
    // Regression: `.env.local` ships empty VITE_*_BASE_URL lines. With `??` an
    // empty string was kept and disabled the provider; it must read as unset.
    expect(cleanEnv("")).toBeUndefined();
    expect(cleanEnv("   ")).toBeUndefined();
    expect(cleanEnv(undefined)).toBeUndefined();
    expect(cleanEnv("/api/twse")).toBe("/api/twse");
    expect(cleanEnv("https://proxy.example.com")).toBe("https://proxy.example.com");
  });
});

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

  it("keeps other providers' merged data when one provider fails", async () => {
    // Regression: a throwing provider (here TWSE MIS) must not discard data that
    // other providers already merged, nor collapse the whole load to mock.
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/exchangeReport/STOCK_DAY_ALL")) {
        return new Response(
          JSON.stringify([
            {
              Date: "1150605",
              Code: "2330",
              Name: "台積電",
              TradeVolume: "43403895",
              TradeValue: "0",
              OpeningPrice: "2395.0000",
              HighestPrice: "2405.0000",
              LowestPrice: "2350.0000",
              ClosingPrice: "2365.0000",
              Change: "-20.0000",
              Transaction: "364351"
            }
          ]),
          { status: 200 }
        );
      }

      if (url.endsWith("/exchangeReport/MI_INDEX")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (url.endsWith("/opendata/t187ap04_L")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      // TWSE MIS responds with a redirect-to-HTML in some environments, which
      // makes the JSON parse throw. Simulate that failure here.
      if (url.includes("/stock/api/getStockInfo.jsp")) {
        return new Response("<html>not json</html>", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const payload = await loadLiveDashboardPayload({
      fetchImpl,
      finnhubApiKey: "",
      twseBaseUrl: "https://proxy.example.com/v1",
      twseMisBaseUrl: "https://proxy.example.com",
      googleNewsBaseUrl: ""
    } as never);

    expect(payload).not.toBeNull();
    expect(payload?.quotes.find((quote) => quote.symbol === "2330")?.price).toBe(2365);
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

  it("merges live macro indicators from FRED, without requesting Finnhub indices", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T09:00:00+08:00"));

    const requestedQuoteSymbols: string[] = [];

    try {
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname.endsWith("/quote")) {
          requestedQuoteSymbols.push(url.searchParams.get("symbol") ?? "");
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
      // Indices come from Yahoo now; Finnhub must only be asked for equity symbols.
      expect(requestedQuoteSymbols).not.toContain("^GSPC");
      expect(requestedQuoteSymbols).not.toContain("^VIX");
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

  it("fetches FRED macros through a relative dev-proxy base URL", async () => {
    // Regression: buildFredSeriesUrl used `new URL()`, which throws on a relative
    // base like "/api/fred", so FRED silently never ran behind the dev proxy.
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("series_id=DEXTAUS")) {
        return new Response(
          JSON.stringify({
            observations: [
              { date: "2026-05-28", value: "31.36" },
              { date: "2026-05-29", value: "31.37" }
            ]
          }),
          { status: 200 }
        );
      }

      if (url.includes("series_id=DGS10")) {
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

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const payload = await loadLiveDashboardPayload({
      fetchImpl,
      finnhubApiKey: "",
      twseBaseUrl: "",
      googleNewsBaseUrl: "",
      fredBaseUrl: "/api/fred",
      fredApiKey: "demo"
    });

    expect(payload).not.toBeNull();
    expect(payload?.macros.find((macro) => macro.key === "usd-twd")?.value).toBe("31.37");
    expect(payload?.macros.find((macro) => macro.key === "us10y")?.value).toBe("4.47%");
  });

  it("merges US index quotes from Yahoo Finance when Finnhub cannot", async () => {
    const makeChart = (price: number, prevClose: number, closes: number[]) =>
      new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: price,
                  chartPreviousClose: prevClose,
                  regularMarketTime: 1780693236
                },
                indicators: { quote: [{ close: closes }] }
              }
            ]
          }
        }),
        { status: 200 }
      );

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/chart/%5EGSPC")) {
        return makeChart(7383.74, 7580.06, [7500, 7520, 7480, 7580.06, 7383.74]);
      }

      if (url.includes("/chart/%5EIXIC")) {
        return makeChart(20011.22, 19800.1, [19500, 19600, 19700, 19800.1, 20011.22]);
      }

      if (url.includes("/chart/%5ESOX")) {
        return makeChart(5300.5, 5250.0, [5200, 5220, 5240, 5250, 5300.5]);
      }

      if (url.includes("/chart/%5EVIX")) {
        return makeChart(21.51, 16.05, [16.05, 15.77, 16.06, 15.4, 21.51]);
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const payload = await loadLiveDashboardPayload({
      fetchImpl,
      finnhubApiKey: "",
      twseBaseUrl: "",
      googleNewsBaseUrl: "",
      yahooBaseUrl: "https://yahoo.example.com"
    });

    expect(payload).not.toBeNull();
    expect(payload?.macros.find((macro) => macro.key === "spx")).toMatchObject({
      value: "7,383.74",
      changePct: -2.59,
      delayTag: "延遲 15 分"
    });
    expect(payload?.macros.find((macro) => macro.key === "vix")?.value).toBe("21.51");
  });

  it("merges SinoPac realtime snapshots for Taiwan stocks and TAIEX", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T10:15:00+08:00")); // TW session open -> "即時"

    try {
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/snapshots")) {
          return new Response(
            JSON.stringify({
              updatedAt: "2026-06-08T10:15:00+08:00",
              quotes: [
                {
                  code: "2330",
                  close: 1185,
                  change_rate: 1.72,
                  total_volume: 23145,
                  ts: "2026-06-08T02:15:00.000Z"
                },
                {
                  code: "2454",
                  close: 1402,
                  change_rate: -0.5,
                  total_volume: 8000,
                  ts: "2026-06-08T02:15:00.000Z"
                }
              ],
              indices: [
                { code: "001", close: 24010.5, change_rate: -0.42, ts: "2026-06-08T02:15:00.000Z" }
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
        twseMisBaseUrl: "",
        googleNewsBaseUrl: "",
        sinopacBaseUrl: "https://sinopac.example.com"
      } as never);

      expect(payload).not.toBeNull();
      expect(payload?.quotes.find((quote) => quote.symbol === "2330")).toMatchObject({
        price: 1185,
        changePct: 1.72,
        volume: 23145,
        delayTag: "即時",
        updatedAt: "2026-06-08T02:15:00.000Z"
      });
      expect(payload?.macros.find((macro) => macro.key === "taiex")).toMatchObject({
        value: "24,010.50",
        changePct: -0.42,
        delayTag: "即時"
      });
    } finally {
      vi.useRealTimers();
    }
  });

});
