"use client"

import { useState } from "react"
import useSWR from "swr"
import { Bell, CheckCheck, Inbox } from "lucide-react"
import { loadNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/firestore"
import type { AppNotification } from "@/lib/types"

export function NotificationCenter({ userId, onOpenProject }: { userId: string; onOpenProject: (projectId: string) => void }) {
  const [open, setOpen] = useState(false)
  const { data: notifications = [], error: loadError, isLoading, mutate } = useSWR<AppNotification[]>(
    `notifications:${userId}`,
    () => loadNotifications(userId),
    { refreshInterval: 30_000, revalidateOnFocus: true },
  )
  const [error, setError] = useState("")
  const unreadCount = notifications.filter((notification) => !notification.read).length

  async function openNotification(notification: AppNotification) {
    if (!notification.read) {
      try {
        await markNotificationRead(userId, notification.id)
        setError("")
        await mutate()
      } catch {
        setError("تعذّر تحديث حالة الإشعار. حاول مرة أخرى.")
      }
    }
    setOpen(false)
    onOpenProject(notification.projectId)
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead(userId, notifications.filter((notification) => !notification.read).map((notification) => notification.id))
      setError("")
      await mutate()
    } catch {
      setError("تعذّر تحديث الإشعارات. حاول مرة أخرى.")
    }
  }

  return (
    <div className="notification-wrap">
      <button
        className="icon-button notification-trigger"
        type="button"
        aria-label={unreadCount ? `الإشعارات، ${unreadCount} غير مقروءة` : "الإشعارات"}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-count" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-panel" id="notification-panel" aria-label="الإشعارات">
          <div className="notification-heading">
            <div><h2>الإشعارات</h2><p>{unreadCount ? `${unreadCount} إشعارات غير مقروءة` : "أنت على اطلاع"}</p></div>
            {unreadCount > 0 && <button className="notification-read-all" type="button" onClick={markAllRead}><CheckCheck aria-hidden="true" /> قراءة الكل</button>}
          </div>
          {(error || loadError) && <p className="notification-error" role="alert">{error || "تعذّر تحميل الإشعارات. حاول تحديث الصفحة."}</p>}
          {isLoading ? (
            <div className="notification-empty" role="status">جارٍ تحميل الإشعارات…</div>
          ) : loadError ? null : notifications.length ? (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button className={`notification-item ${notification.read ? "is-read" : ""}`} type="button" onClick={() => openNotification(notification)}>
                    <span className="notification-indicator" aria-hidden="true" />
                    <span className="notification-copy"><strong>{notification.title}</strong><span>{notification.message}</span><time>{formatNotificationDate(notification.createdAt)}</time></span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="notification-empty"><Inbox aria-hidden="true" /><strong>لا توجد إشعارات بعد</strong><span>ستظهر هنا تنبيهات إسناد المهام وإضافتك إلى المشاريع.</span></div>
          )}
        </section>
      )}
    </div>
  )
}

function formatNotificationDate(timestamp: number) {
  if (!timestamp) return "الآن"
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp))
}
