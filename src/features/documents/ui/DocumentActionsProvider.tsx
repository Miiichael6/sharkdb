import { useMemo, useState, type ReactNode } from "react";
import { useServices } from "../../../app/services";
import type { DocumentTarget } from "../../../shared/domain/documentTarget";
import { ConfirmDialog } from "../../../shared/ui/common";
import { DocumentActionsContext, type DocumentActions } from "../../../shared/ui/documentActions";
import { useLog } from "../../../shared/ui/useLog";
import type { Doc } from "../../explorer/domain/mongo";
import { formatEditable } from "../../shell/domain/bsonFormat";
import { DocumentEditorDialog, type EditorMode } from "./DocumentEditorDialog";

/** Text the insert editor starts with. */
const NEW_DOCUMENT = "{\n  \n}";

type Dialog =
  | { kind: "editor"; mode: EditorMode; target: DocumentTarget; initial: string; save: (doc: Doc) => Promise<void> }
  | { kind: "confirm"; title: string; message: string; confirmLabel: string; run: () => Promise<void> };

const namespace = (t: DocumentTarget) => `${t.db}.${t.coll}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Offers the document actions to the whole app and shows their editor and confirmations. */
export function DocumentActionsProvider({ children }: { children: ReactNode }) {
  const { documents } = useServices();
  const log = useLog();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);

  const actions = useMemo<DocumentActions>(() => {
    /** Runs a confirmed deletion, logging how many documents it removed. */
    const deletion = (target: DocumentTarget, remove: () => Promise<number>, onDone: () => void) => async () => {
      try {
        const n = await remove();
        log.info(`${plural(n, "documento eliminado", "documentos eliminados")} de ${namespace(target)}`);
        onDone();
      } catch (e) {
        log.error(`No se pudo eliminar en ${namespace(target)}`, e);
      }
    };

    return {
      view: (target, doc) =>
        setDialog({ kind: "editor", mode: "view", target, initial: formatEditable(doc), save: async () => {} }),
      edit: (target, doc, onDone) =>
        setDialog({
          kind: "editor",
          mode: "edit",
          target,
          initial: formatEditable(doc),
          save: async (edited) => {
            const saved = await documents.replaceDocument(target, doc, edited);
            log.info(`Documento actualizado en ${namespace(target)}`);
            onDone(saved);
          },
        }),
      insert: (target, onDone) =>
        setDialog({
          kind: "editor",
          mode: "insert",
          target,
          initial: NEW_DOCUMENT,
          save: async (doc) => {
            await documents.insertDocument(target, doc);
            log.info(`Documento insertado en ${namespace(target)}`);
            onDone();
          },
        }),
      remove: (target, docs, onDone) =>
        setDialog({
          kind: "confirm",
          title: docs.length === 1 ? "Eliminar documento" : "Eliminar documentos",
          message: `¿Eliminar ${plural(docs.length, "documento", "documentos")} de ${namespace(target)}? No se puede deshacer.`,
          confirmLabel: "Eliminar",
          run: deletion(target, () => documents.deleteDocuments(target, docs), onDone),
        }),
      removeAll: (target, onDone) =>
        setDialog({
          kind: "confirm",
          title: "Eliminar todos los documentos",
          message: `¿Eliminar todos los documentos de ${namespace(target)}? La colección y sus índices se conservan. No se puede deshacer.`,
          confirmLabel: "Eliminar todos",
          run: deletion(target, () => documents.deleteAll(target), onDone),
        }),
    };
  }, [documents, log]);

  return (
    <DocumentActionsContext.Provider value={actions}>
      {children}
      {dialog?.kind === "editor" && (
        <DocumentEditorDialog
          mode={dialog.mode}
          namespace={namespace(dialog.target)}
          initial={dialog.initial}
          onSave={async (doc) => {
            await dialog.save(doc);
            close();
          }}
          onClose={close}
        />
      )}
      {dialog?.kind === "confirm" && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          onConfirm={() => {
            close();
            dialog.run();
          }}
          onCancel={close}
        />
      )}
    </DocumentActionsContext.Provider>
  );
}
