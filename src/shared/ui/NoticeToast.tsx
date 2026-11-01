import { useNotifications } from "./useNotifications";

/** The latest notification as a toast in the corner; it stays in the notification center too. */
export function NoticeToast() {
  const { toast, toastMs, dismissToast } = useNotifications();
  if (!toast) return null;
  return (
    <div className={`notice ${toast.level}`} role={toast.level === "error" ? "alert" : "status"}>
      <span>{toast.text}</span>
      <button className="ghost" onClick={dismissToast} aria-label="Cerrar">
        ✕
      </button>
      {toast.level === "error" && (
        // Keyed by id so a new error restarts the countdown.
        <div key={toast.id} className="notice-timer" style={{ animationDuration: `${toastMs}ms` }} />
      )}
    </div>
  );
}
