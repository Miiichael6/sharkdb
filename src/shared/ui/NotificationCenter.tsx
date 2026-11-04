import { useEffect, useRef } from "react";
import { logTime } from "../domain/log";
import { newestFirst, type NotificationLevel } from "../domain/notifications";
import { useExclusivePopup } from "./useExclusivePopup";
import { useFitInWindow } from "./useFitInWindow";
import { useNotifications } from "./useNotifications";

const LEVEL_LABELS: Record<NotificationLevel, string> = { ok: "Hecho", info: "Aviso", error: "Error" };

interface Props {
  x: number;
  y: number;
  onClose: () => void;
}

/** History of the session's notifications, anchored under the bell of the toolbar. */
export function NotificationCenter({ x, y, onClose }: Props) {
  const { entries, unread, markAllRead, clear } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);
  useFitInWindow(ref, x, y);
  useExclusivePopup(onClose);

  // Closes on a click outside, Escape or leaving the window, like the other popups.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="notification-center" role="dialog" aria-label="Notificaciones">
      <header>
        <strong>Notificaciones</strong>
        <button className="ghost small" onClick={markAllRead} disabled={!unread}>
          Marcar todo como leído
        </button>
        <button className="ghost small" onClick={clear} disabled={!entries.length}>
          Limpiar
        </button>
      </header>
      {entries.length ? (
        <ul>
          {newestFirst(entries).map((n) => (
            <li key={n.id} className={`${n.level} ${n.read ? "" : "unread"}`}>
              <span className="notification-meta">
                {logTime(n.at)} · {LEVEL_LABELS[n.level]}
              </span>
              <span className="notification-text">{n.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted notification-empty">No hay notificaciones en esta sesión.</p>
      )}
    </div>
  );
}
