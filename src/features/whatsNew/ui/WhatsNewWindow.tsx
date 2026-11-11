import { useEffect } from "react";
import type { ChangeKind } from "../domain/releaseNotes";
import type { WhatsNewData } from "./whatsNewViews";

const KIND_LABEL: Record<ChangeKind, string> = { nuevo: "Nuevo", mejora: "Mejora", arreglo: "Arreglo" };

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

/** "Novedades", the content of its own window: each version with its changes, newest first. */
export function WhatsNewWindow({ data, onDone }: { data: WhatsNewData; onDone: () => void }) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="whats-new">
      <div className="whats-new-hero">
        <h2>Novedades de SharkDB</h2>
        <p className="muted">Esto es lo que hemos estado puliendo.</p>
      </div>
      <div className="whats-new-body">
        {data.notes.map((note) => (
          <section key={note.version} className="whats-new-release">
            <header>
              <h3>Versión {note.version}</h3>
              {note.version === data.current && <span className="whats-new-current">Actual</span>}
              <span className="spacer" />
              <span className="muted">{formatDate(note.date)}</span>
            </header>
            <ul>
              {note.changes.map((change, i) => (
                <li key={i}>
                  <span className={`whats-new-kind ${change.kind}`}>{KIND_LABEL[change.kind]}</span>
                  <span>{change.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="modal-footer">
        <span className="spacer" />
        <button className="primary" onClick={onDone} autoFocus>
          Entendido
        </button>
      </div>
    </div>
  );
}
