// Notification history of the session: every toast lands here so it can be reviewed later.

export type NotificationLevel = "ok" | "info" | "error";

export interface AppNotification {
  id: number;
  level: NotificationLevel;
  text: string;
  /** Epoch milliseconds. */
  at: number;
  read: boolean;
}

export const NOTIFICATION_LIMIT = 200;

/** Adds an unread notification, dropping the oldest ones past `limit`. */
export function addNotification(
  list: AppNotification[],
  entry: Pick<AppNotification, "level" | "text" | "at">,
  limit = NOTIFICATION_LIMIT,
): AppNotification[] {
  const id = (list[list.length - 1]?.id ?? 0) + 1;
  return [...list, { ...entry, id, read: false }].slice(-limit);
}

export const markAllRead = (list: AppNotification[]): AppNotification[] =>
  list.some((n) => !n.read) ? list.map((n) => (n.read ? n : { ...n, read: true })) : list;

export const unreadCount = (list: AppNotification[]) => list.filter((n) => !n.read).length;

/** Newest first, as the notification center lists them. */
export const newestFirst = (list: AppNotification[]) => [...list].reverse();

/** Text of the unread badge: big counts are capped so the badge keeps its size. */
export const BADGE_MAX = 99;
export const badgeText = (count: number) => (count > BADGE_MAX ? `${BADGE_MAX}+` : String(count));
