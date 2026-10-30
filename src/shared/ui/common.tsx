import { useEffect, type ReactNode } from "react";

export function Logo({ size = 120 }: { size?: number }) {
  // Faceted leaf, drawn as flat triangles.
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <polygon points="50,4 30,40 50,52" fill="#3fd17a" />
      <polygon points="50,4 70,40 50,52" fill="#1f9d55" />
      <polygon points="30,40 26,66 50,52" fill="#2bb866" />
      <polygon points="70,40 74,66 50,52" fill="#157a41" />
      <polygon points="26,66 50,84 50,52" fill="#1f9d55" />
      <polygon points="74,66 50,84 50,52" fill="#0f5f32" />
      <polygon points="47,84 53,84 52,97 48,97" fill="#8b6b45" />
    </svg>
  );
}

export function Avatar({ color, label = "Mg", size = 34 }: { color: string; label?: string; size?: number }) {
  return (
    <div className="avatar" style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}>
      {label}
    </div>
  );
}

export function Modal({
  children,
  onClose,
  className = "",
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${className}`}>{children}</div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal onClose={onCancel} className="confirm">
      <h3>{title}</h3>
      <p>{message}</p>
      <div className="modal-footer">
        <span className="spacer" />
        <button onClick={onCancel}>Cancelar</button>
        <button className="danger" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Spinner() {
  return <span className="spinner" aria-label="Cargando" />;
}
