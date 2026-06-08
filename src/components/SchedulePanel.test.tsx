import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchedulePanel } from "./SchedulePanel";

const sampleBrief = {
  sessionLabel: "台股盤後摘要",
  headline: "台積電盤後法說重點整理",
  bullets: [
    "TAIEX 收在 45,210.35。",
    "台積電與聯發科延續高檔震盪。"
  ],
  focusSymbols: ["2330", "2454"],
  sentiment: "bullish" as const,
  updatedAt: "2026-06-08T15:10:00+08:00"
};

describe("SchedulePanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("requests browser notification permission from the schedule panel", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const notificationSpy = vi.fn();

    function MockNotification(title: string, options?: NotificationOptions) {
      notificationSpy(title, options);
    }

    Object.assign(MockNotification, {
      permission: "default",
      requestPermission
    });

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: MockNotification
    });

    render(<SchedulePanel brief={sampleBrief} />);

    fireEvent.click(screen.getByRole("button", { name: "啟用桌面通知" }));

    await waitFor(() => {
      expect(requestPermission).toHaveBeenCalledOnce();
      expect(screen.getByText("桌面通知已啟用")).toBeInTheDocument();
    });
  });

  it("shows a desktop notification when a due schedule auto-generates a brief", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T15:10:00+08:00"));

    const notificationSpy = vi.fn();

    function MockNotification(title: string, options?: NotificationOptions) {
      notificationSpy(title, options);
    }

    Object.assign(MockNotification, {
      permission: "granted",
      requestPermission: vi.fn().mockResolvedValue("granted")
    });

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: MockNotification
    });

    window.localStorage.setItem(
      "stock-tracker-dashboard:brief-notification-enabled",
      JSON.stringify(true)
    );
    window.localStorage.setItem(
      "stock-tracker-dashboard:brief-history",
      JSON.stringify([
        {
          id: "tw-pre-1",
          scheduleId: "tw-pre",
          label: "台股開盤前",
          headline: "早盤預備",
          text: "早盤預備",
          createdAt: "2026-06-08T08:35:00+08:00",
          sentiment: "neutral",
          focusSymbols: ["2330"]
        }
      ])
    );

    try {
      render(<SchedulePanel brief={sampleBrief} />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(notificationSpy).toHaveBeenCalledWith(
        "台股收盤後",
        expect.objectContaining({
          body: expect.stringContaining("台積電盤後法說重點整理")
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("backfills multiple due schedules in schedule-time order", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T15:10:00+08:00"));

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("default")
      }
    });

    try {
      render(<SchedulePanel brief={sampleBrief} />);

      await act(async () => {
        await Promise.resolve();
      });

      const history = JSON.parse(
        window.localStorage.getItem("stock-tracker-dashboard:brief-history") ?? "[]"
      );

      expect(history[0].scheduleId).toBe("tw-post");
      expect(history[1].scheduleId).toBe("tw-pre");
    } finally {
      vi.useRealTimers();
    }
  });
});
