import { useEffect, useState } from "react";
import { createDueRunnerEntries } from "../lib/briefRunner";
import {
  appendBriefHistory,
  buildBriefHistoryEntry,
  getNextRunAt,
  loadBriefHistory,
  loadBriefNotificationPreference,
  loadBriefSchedules,
  saveBriefHistory,
  saveBriefNotificationPreference,
  saveBriefSchedules
} from "../lib/briefSchedule";
import type { BriefHistoryEntry, BriefSchedule, DailyBrief } from "../types";

interface SchedulePanelProps {
  brief: DailyBrief | null;
}

type NotificationStatus = NotificationPermission | "unsupported";

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

function sentimentLabel(sentiment: BriefHistoryEntry["sentiment"]) {
  if (sentiment === "bullish") {
    return "偏多";
  }

  if (sentiment === "bearish") {
    return "偏空";
  }

  return "中性";
}

export function SchedulePanel({ brief }: SchedulePanelProps) {
  const [schedules, setSchedules] = useState<BriefSchedule[]>(() => loadBriefSchedules());
  const [history, setHistory] = useState<BriefHistoryEntry[]>(() => loadBriefHistory());
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() =>
    loadBriefNotificationPreference()
  );
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>(() =>
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "unsupported"
  );
  const [copiedEntryId, setCopiedEntryId] = useState<string | null>(null);

  useEffect(() => {
    saveBriefNotificationPreference(notificationsEnabled);
  }, [notificationsEnabled]);

  useEffect(() => {
    saveBriefSchedules(schedules);
  }, [schedules]);

  useEffect(() => {
    saveBriefHistory(history);
  }, [history]);

  useEffect(() => {
    if (!copiedEntryId) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setCopiedEntryId(null);
    }, 2400);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [copiedEntryId]);

  useEffect(() => {
    if (!brief) {
      return;
    }

    const syncDueSchedules = () => {
      const nextEntries = createDueRunnerEntries(
        brief,
        {
          schedules,
          history
        },
        new Date()
      );

      if (nextEntries.length === 0) {
        return;
      }

      setHistory((currentHistory) => appendBriefHistory(currentHistory, nextEntries));

      if (
        notificationsEnabled &&
        notificationStatus === "granted" &&
        typeof window !== "undefined" &&
        "Notification" in window
      ) {
        nextEntries.forEach((entry) => {
          new window.Notification(entry.label, {
            body: `${entry.headline}｜${entry.focusSymbols.join("、")}`,
            tag: entry.id
          });
        });
      }
    };

    syncDueSchedules();

    const timerId = window.setInterval(syncDueSchedules, 1000 * 30);

    return () => {
      window.clearInterval(timerId);
    };
  }, [brief, history, notificationStatus, notificationsEnabled, schedules]);

  const handleManualCreate = () => {
    if (!brief) {
      return;
    }

    setHistory((currentHistory) =>
      appendBriefHistory(
        currentHistory,
        [
          buildBriefHistoryEntry(brief, {
            scheduleId: "manual",
            label: "手動建立",
            now: new Date()
          })
        ]
      )
    );
  };

  const handleCopy = async (entry: BriefHistoryEntry) => {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(entry.text);
      setCopiedEntryId(entry.id);
    } catch {
      setCopiedEntryId(null);
    }
  };

  const handleRequestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationStatus("unsupported");
      return;
    }

    const permission = await window.Notification.requestPermission();

    setNotificationStatus(permission);
    setNotificationsEnabled(permission === "granted");
  };

  const notificationMessage =
    notificationStatus === "unsupported"
      ? "目前瀏覽器不支援桌面通知"
      : notificationStatus === "granted" && notificationsEnabled
        ? "桌面通知已啟用"
        : notificationStatus === "granted"
          ? "桌面通知已授權，目前暫停"
          : notificationStatus === "denied"
            ? "桌面通知已被瀏覽器封鎖"
            : "尚未授權桌面通知";

  return (
    <section className="dashboard-panel schedule-panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Schedule</p>
          <h2>排程與摘要紀錄</h2>
        </div>
        <p className="section-note">頁面內排程會保留在本機；若要頁面關閉後也自動產生，可改用本機背景排程。</p>
      </div>

      <div className="schedule-grid">
        <div className="schedule-config">
          <div className="schedule-actions">
            <div className="schedule-action-card">
              <button
                className="secondary-button"
                disabled={!brief}
                onClick={handleManualCreate}
                type="button"
              >
                立即產生摘要
              </button>
              <p className="section-note">可先用手動建立檢查輸出，再交給每日時段自動補產生。</p>
            </div>

            <div className="schedule-action-card">
              <p className="brief-side-label">桌面通知</p>
              <strong>{notificationMessage}</strong>
              <p className="section-note">頁面開啟時會跳出瀏覽器通知；頁面未開啟時可改由背景排程寫出摘要檔。</p>
              {notificationStatus === "unsupported" || notificationStatus === "denied" ? null : (
                <button
                  className="secondary-button"
                  onClick={() => {
                    if (notificationStatus === "granted") {
                      setNotificationsEnabled((current) => !current);
                      return;
                    }

                    void handleRequestNotifications();
                  }}
                  type="button"
                >
                  {notificationStatus === "granted"
                    ? notificationsEnabled
                      ? "暫停桌面通知"
                      : "恢復桌面通知"
                    : "啟用桌面通知"}
                </button>
              )}
            </div>
          </div>

          <div className="schedule-list">
            {schedules.map((schedule) => (
              <article className="schedule-card" key={schedule.id}>
                <div className="schedule-card-topline">
                  <div>
                    <h3>{schedule.label}</h3>
                    <p>{schedule.description}</p>
                  </div>

                  <label className="schedule-toggle">
                    <input
                      checked={schedule.enabled}
                      onChange={(event) => {
                        setSchedules((currentSchedules) =>
                          currentSchedules.map((item) =>
                            item.id === schedule.id
                              ? { ...item, enabled: event.target.checked }
                              : item
                          )
                        );
                      }}
                      type="checkbox"
                    />
                    <span>{schedule.enabled ? "啟用" : "停用"}</span>
                  </label>
                </div>

                <div className="schedule-card-controls">
                  <label className="schedule-time-field">
                    <span>排程時間</span>
                    <input
                      aria-label={`${schedule.label} 排程時間`}
                      onChange={(event) => {
                        setSchedules((currentSchedules) =>
                          currentSchedules.map((item) =>
                            item.id === schedule.id
                              ? { ...item, time: event.target.value || item.time }
                              : item
                          )
                        );
                      }}
                      type="time"
                      value={schedule.time}
                    />
                  </label>

                  <p className="section-note">
                    {schedule.enabled
                      ? `下次執行 ${formatDateTime(getNextRunAt(schedule))}`
                      : "目前停用，不會自動建立摘要。"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="schedule-history">
          <div className="schedule-history-head">
            <div>
              <p className="brief-side-label">最近紀錄</p>
              <p className="section-note">保留最近 12 筆，可直接複製貼到 Slack、LINE 或每日工作紀錄。</p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="schedule-empty-state">
              <p>尚未產生摘要紀錄。</p>
            </div>
          ) : (
            <div className="schedule-history-list">
              {history.map((entry) => (
                <article className="schedule-history-card" key={entry.id}>
                  <div className="schedule-history-topline">
                    <span className="brief-session">{entry.label}</span>
                    <span className={`sentiment-badge sentiment-${entry.sentiment}`}>
                      {sentimentLabel(entry.sentiment)}
                    </span>
                  </div>

                  <h3>{entry.headline}</h3>

                  <p className="section-note">
                    {formatDateTime(entry.createdAt)}
                    <span className="dot-separator">•</span>
                    {entry.focusSymbols.join("、")}
                  </p>

                  <div className="schedule-history-actions">
                    <button
                      aria-label={`複製 ${entry.label} 摘要`}
                      className="secondary-button"
                      onClick={() => {
                        void handleCopy(entry);
                      }}
                      type="button"
                    >
                      複製內容
                    </button>

                    <span className="section-note">
                      {copiedEntryId === entry.id ? "已複製" : entry.scheduleId === "manual" ? "手動產生" : "自動排程"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
