import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addNotification,
  markAllRead,
  unreadCount,
  type AppNotification,
  type NotificationLevel,
} from "../domain/notifications";
import { errorMessage } from "../errors";

/** How long a toast stays; errors linger a bit longer and remain in the notification center. */
const TOAST_MS = 3000;
const ERROR_TOAST_MS = 5000;

interface NotificationWriter {
  ok: (text: string) => void;
  info: (text: string) => void;
  fail: (e: unknown) => void;
}

interface NotificationView {
  /** The whole history of the session, oldest first. */
  entries: AppNotification[];
  unread: number;
  /** The notification shown as a toast, if any. */
  toast: AppNotification | null;
  /** How long the current toast stays before it closes on its own. */
  toastMs: number;
  dismissToast: () => void;
  markAllRead: () => void;
  clear: () => void;
}

// Split so components that only notify don't re-render on every new notification.
const WriterContext = createContext<NotificationWriter | null>(null);
const ViewContext = createContext<NotificationView | null>(null);

/**
 * Notifications of the session: each one shows as a toast and stays in the history that the
 * notification center lists.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AppNotification[]>([]);
  // The toast always shows the latest notification, until it times out or is dismissed.
  const [toastOpen, setToastOpen] = useState(false);

  const writer = useMemo<NotificationWriter>(() => {
    const add = (level: NotificationLevel, text: string) => {
      setEntries((list) => addNotification(list, { level, text, at: Date.now() }));
      setToastOpen(true);
    };
    return {
      ok: (text) => add("ok", text),
      info: (text) => add("info", text),
      fail: (e) => add("error", errorMessage(e)),
    };
  }, []);

  const toast = (toastOpen && entries[entries.length - 1]) || null;
  // Keyed by id: marking the toast read must not restart its timer.
  const toastId = toast?.id ?? null;
  const toastMs = toast?.level === "error" ? ERROR_TOAST_MS : TOAST_MS;
  useEffect(() => {
    if (toastId === null) return;
    const t = setTimeout(() => setToastOpen(false), toastMs);
    return () => clearTimeout(t);
  }, [toastId, toastMs]);

  const dismissToast = useCallback(() => setToastOpen(false), []);
  const readAll = useCallback(() => setEntries(markAllRead), []);
  const clear = useCallback(() => {
    setEntries([]);
    setToastOpen(false);
  }, []);
  const view = useMemo<NotificationView>(
    () => ({ entries, unread: unreadCount(entries), toast, toastMs, dismissToast, markAllRead: readAll, clear }),
    [entries, toast, toastMs, dismissToast, readAll, clear],
  );

  return (
    <WriterContext.Provider value={writer}>
      <ViewContext.Provider value={view}>{children}</ViewContext.Provider>
    </WriterContext.Provider>
  );
}

function required<T>(value: T | null): T {
  if (!value) throw new Error("Notification hooks must be used inside <NotificationsProvider>");
  return value;
}

/** Sends notifications (toast + history). */
export const useNotify = () => required(useContext(WriterContext));

/** The history, the current toast and what can be done with them. */
export const useNotifications = () => required(useContext(ViewContext));
