import { describe, expect, it, vi } from "vitest";
import { deliverBriefEntries } from "./briefDelivery";

const sampleEntry = {
  id: "tw-post-1",
  scheduleId: "tw-post" as const,
  label: "台股收盤後",
  headline: "台積電盤後法說重點整理",
  text: "台股盤後摘要｜台積電盤後法說重點整理\n關注焦點：2330、2454",
  createdAt: "2026-06-08T07:05:00.000Z",
  sentiment: "bullish" as const,
  focusSymbols: ["2330", "2454"]
};

describe("briefDelivery", () => {
  it("posts generated brief entries as generic json", async () => {
    const fetchSpy = vi.fn(
      async (..._args: [RequestInfo | URL, RequestInit?]) => new Response("ok", { status: 200 })
    );
    const fetchImpl = fetchSpy as unknown as typeof fetch;

    await deliverBriefEntries([sampleEntry], {
      webhookUrl: "https://hooks.example.com/brief",
      fetchImpl,
      format: "json",
      source: "live"
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://hooks.example.com/brief",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json"
        }),
        body: expect.stringContaining("\"headline\":\"台積電盤後法說重點整理\"")
      })
    );
  });

  it("posts generated brief entries as a slack text payload", async () => {
    const fetchSpy = vi.fn(
      async (..._args: [RequestInfo | URL, RequestInit?]) => new Response("ok", { status: 200 })
    );
    const fetchImpl = fetchSpy as unknown as typeof fetch;

    await deliverBriefEntries([sampleEntry], {
      webhookUrl: "https://hooks.slack.com/services/test",
      fetchImpl,
      format: "slack",
      source: "live"
    });

    expect(fetchSpy).toHaveBeenCalledOnce();

    const firstCall = fetchSpy.mock.calls[0];
    const init = firstCall?.[1];
    const payload = JSON.parse(String(init?.body));

    expect(payload.text).toContain("台股收盤後");
    expect(payload.text).toContain("台積電盤後法說重點整理");
    expect(payload.text).toContain("2330、2454");
  });
});
