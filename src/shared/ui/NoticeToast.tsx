import type { Notice } from "./useNotice";

export function NoticeToast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  if (!notice) return null;
  return (
    <div className={`notice ${notice.kind}`} role="status">
      <span>{notice.text}</span>
      <button className="ghost" onClick={onDismiss} aria-label="Cerrar">
        ✕
      </button>
    </div>
  );
}
