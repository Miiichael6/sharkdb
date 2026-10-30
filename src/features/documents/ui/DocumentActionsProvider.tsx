import { useMemo, useState, type ReactNode } from "react";
import { useServices } from "../../../app/services";
import type { DocumentTarget } from "../../../shared/domain/documentTarget";
import { ConfirmDialog } from "../../../shared/ui/common";
import { DocumentActionsContext, type DocumentActions } from "../../../shared/ui/documentActions";
import { openModalWindow } from "../../../shared/ui/modalWindow";
import { useLog } from "../../../shared/ui/useLog";
import { formatEditable } from "../../shell/domain/bsonFormat";
import { EDITOR_TITLES } from "./DocumentEditorDialog";
import { DOCUMENT_EDITOR_VIEW, type DocumentEditorData, type DocumentEditorResult } from "./DocumentEditorWindow";

/** Text the insert editor starts with. */
const NEW_DOCUMENT = "{\n  \n}";

type Dialog = { kind: "confirm"; title: string; message: string; confirmLabel: string; run: () => Promise<void> };

const namespace = (t: DocumentTarget) => `${t.db}.${t.coll}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Offers the document actions to the whole app and shows their editor and confirmations. */
export function DocumentActionsProvider({ children }: { children: ReactNode }) {
  const { documents } = useServices();
  const log = useLog();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);

  const actions = useMemo<DocumentActions>(() => {
    /** The editor in its own window, which keeps this one disabled until it closes; null when nothing was saved. */
    const openEditor = async (data: DocumentEditorData) => {
      try {
        return await openModalWindow<DocumentEditorResult>(DOCUMENT_EDITOR_VIEW, data, {
          title: `${EDITOR_TITLES[data.mode]} · ${namespace(data.target)}`,
          width: 760,
          height: 600,
          maximizable: true,
        });
      } catch (e) {
        log.error("No se pudo abrir el editor de documentos", e);
        return null;
      }
    };

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
      view: (target, doc) => void openEditor({ mode: "view", target, initial: formatEditable(doc) }),
      edit: async (target, doc, onDone) => {
        const result = await openEditor({ mode: "edit", target, initial: formatEditable(doc), original: doc });
        if (!result?.saved) return;
        log.info(`Documento actualizado en ${namespace(target)}`);
        onDone(result.saved);
      },
      insert: async (target, onDone) => {
        if (!(await openEditor({ mode: "insert", target, initial: NEW_DOCUMENT }))) return;
        log.info(`Documento insertado en ${namespace(target)}`);
        onDone();
      },
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
      {dialog && (
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
