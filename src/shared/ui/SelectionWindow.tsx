import { useEffect, type FormEvent, type ReactNode } from "react";

interface Props {
  /** The origin's `Endpoint`. */
  source: ReactNode;
  /** The destination's `Endpoint`. */
  target: ReactNode;
  /** Line under both ends (e.g. production never appears as destination). */
  note?: ReactNode;
  /** The picker and the plan. */
  children?: ReactNode;
  error?: string;
  /** "2 bases de datos · 35 colecciones" next to the buttons. */
  footer: string;
  /** "Continuar" is enabled. */
  ready: boolean;
  onContinue: () => void;
  onClose: () => void;
}

/**
 * First window of sync, backup and restore: origin → destination, what to take, and "Continuar". It
 * neither confirms nor runs anything; Escape closes it.
 */
export function SelectionWindow({ source, target, note, children, error, footer, ready, onContinue, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) onContinue();
  };

  return (
    <form className="selection-window" onSubmit={submit}>
      <div className="selection-body">
        <div className="selection-endpoints">
          {source}
          <div className="selection-arrow" aria-hidden>
            →
          </div>
          {target}
        </div>
        <p className="muted small selection-note">{note}</p>
        {children}
        {error && <p className="test error">{error}</p>}
      </div>

      <div className="modal-footer selection-footer">
        <span className="muted small">{footer}</span>
        <span className="spacer" />
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="primary" disabled={!ready}>
          Continuar
        </button>
      </div>
    </form>
  );
}
