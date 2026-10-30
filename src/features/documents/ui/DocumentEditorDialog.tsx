import { setDiagnostics, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/services";
import { errorMessage } from "../../../shared/errors";
import { CodeEditor } from "../../../shared/ui/CodeEditor";
import { Spinner } from "../../../shared/ui/common";
import type { Doc } from "../../explorer/domain/mongo";
import type { ScriptError } from "../../shell/domain/outcome";

export type EditorMode = "view" | "edit" | "insert";

export const EDITOR_TITLES: Record<EditorMode, string> = {
  view: "Ver documento",
  edit: "Editar documento",
  insert: "Insertar documento",
};
const SAVE_LABELS: Record<Exclude<EditorMode, "view">, string> = { edit: "Guardar", insert: "Insertar" };
const VALID = "Documento válido";

type Status = { kind: "ok" | "error"; text: string } | null;

/** The whole line the error points to, or the first line when it has none. */
function diagnosticOf(view: EditorView, error: ScriptError): Diagnostic {
  const doc = view.state.doc;
  const line = doc.line(Math.min(Math.max(error.line ?? 1, 1), doc.lines));
  return { from: line.from, to: line.to, severity: "error", message: error.message };
}

const describe = (error: ScriptError) => (error.line ? `Línea ${error.line}: ${error.message}` : error.message);

/**
 * Robo 3T's document editor, the content of its own window: shell syntax (`ObjectId(…)`, `ISODate(…)`…),
 * validated before it is saved. Escape closes it.
 */
export function DocumentEditorDialog({
  mode,
  initial,
  onSave,
  onClose,
}: {
  mode: EditorMode;
  initial: string;
  onSave: (doc: Doc) => Promise<void>;
  onClose: () => void;
}) {
  const { documents } = useServices();
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const view = useRef<EditorView | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** The document the text describes, or null after marking why it isn't one. */
  async function validate(): Promise<Doc | null> {
    const { document, error } = await documents.parse(text);
    const editor = view.current!;
    editor.dispatch(setDiagnostics(editor.state, error ? [diagnosticOf(editor, error)] : []));
    setStatus(error ? { kind: "error", text: describe(error) } : null);
    return error ? null : document;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setStatus({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const check = () =>
    run(async () => {
      if (await validate()) setStatus({ kind: "ok", text: VALID });
    });
  const save = () =>
    run(async () => {
      const doc = await validate();
      if (doc) await onSave(doc);
    });

  return (
    <div className="document-window">
      <CodeEditor
        className="document-editor"
        value={text}
        onChange={setText}
        onView={(v) => (view.current = v)}
        readOnly={mode === "view"}
        autoFocus
      />
      {status && <p className={`test ${status.kind}`}>{status.text}</p>}
      <div className="modal-footer">
        {mode !== "view" && (
          <button type="button" onClick={check} disabled={busy}>
            Validar
          </button>
        )}
        <span className="spacer" />
        <button type="button" onClick={onClose}>
          {mode === "view" ? "Cerrar" : "Cancelar"}
        </button>
        {mode !== "view" && (
          <button type="button" className="primary" onClick={save} disabled={busy}>
            {busy && <Spinner />} {SAVE_LABELS[mode]}
          </button>
        )}
      </div>
    </div>
  );
}
