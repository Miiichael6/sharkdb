import { useMemo, type ReactNode } from "react";
import { useServices } from "../../../app/services";
import type { ConfirmRequest } from "../../../shared/domain/confirmation";
import { describeWhere, type DocumentTarget, type TargetWhere } from "../../../shared/domain/documentTarget";
import { confirmInWindow } from "../../../shared/ui/confirmInWindow";
import { DocumentActionsContext, type DocumentActions } from "../../../shared/ui/documentActions";
import { openModalWindow } from "../../../shared/ui/modalWindow";
import { useLog } from "../../../shared/ui/useLog";
import { useServerOf } from "../../connections/ui/useTargetServer";
import { formatEditable, formatValue } from "../../shell/domain/bsonFormat";
import { EDITOR_TITLES } from "./DocumentEditorDialog";
import { DOCUMENT_EDITOR_VIEW, type DocumentEditorData, type DocumentEditorResult } from "./DocumentEditorWindow";

/** Text the insert editor starts with. */
const NEW_DOCUMENT = "{\n  \n}";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Offers the document actions to the whole app and shows their editor and confirmations. */
export function DocumentActionsProvider({ children }: { children: ReactNode }) {
  const { documents } = useServices();
  const log = useLog();
  const serverOf = useServerOf();

  const actions = useMemo<DocumentActions>(() => {
    const whereOf = (t: DocumentTarget): TargetWhere => ({ server: serverOf(t.sid), db: t.db, coll: t.coll });
    /** "LOCAL · shop.orders", for the log. */
    const describe = (t: DocumentTarget) => describeWhere(whereOf(t));

    /** The editor in its own window, which keeps this one disabled until it closes; null when nothing was saved. */
    const openEditor = async (request: Omit<DocumentEditorData, "where">) => {
      const data: DocumentEditorData = { ...request, where: whereOf(request.target) };
      try {
        return await openModalWindow<DocumentEditorResult>(DOCUMENT_EDITOR_VIEW, data, {
          // The editor shows where the document is, so the title only says what is being done.
          title: EDITOR_TITLES[data.mode],
          width: 1000,
          height: 760,
          maximizable: true,
        });
      } catch (e) {
        log.error("No se pudo abrir el editor de documentos", e);
        return null;
      }
    };

    /** Asks first, then deletes, logging how many documents it removed. */
    const deletion = async (request: ConfirmRequest, target: DocumentTarget, remove: () => Promise<number>, onDone: () => void) => {
      if (!(await confirmInWindow({ ...request, where: whereOf(target) }))) return;
      try {
        const n = await remove();
        log.info(`${plural(n, "documento eliminado", "documentos eliminados")} de ${describe(target)}`);
        onDone();
      } catch (e) {
        log.error(`No se pudo eliminar en ${describe(target)}`, e);
      }
    };

    return {
      view: (target, doc, zone) => void openEditor({ mode: "view", target, initial: formatValue(doc, zone), original: doc, zone }),
      edit: async (target, doc, onDone) => {
        const result = await openEditor({ mode: "edit", target, initial: formatEditable(doc), original: doc });
        if (!result?.saved) return;
        log.info(`Documento actualizado en ${describe(target)}`);
        onDone(result.saved);
      },
      insert: async (target, onDone) => {
        if (!(await openEditor({ mode: "insert", target, initial: NEW_DOCUMENT }))) return;
        log.info(`Documento insertado en ${describe(target)}`);
        onDone();
      },
      remove: (target, docs, onDone) =>
        void deletion(
          {
            title: docs.length === 1 ? "Eliminar documento" : "Eliminar documentos",
            message: `¿Eliminar ${plural(docs.length, "documento", "documentos")}? No se puede deshacer.`,
            confirmLabel: "Eliminar",
          },
          target,
          () => documents.deleteDocuments(target, docs),
          onDone,
        ),
      removeAll: (target, onDone) =>
        void deletion(
          {
            title: "Eliminar todos los documentos",
            message: "¿Eliminar todos los documentos de la colección? La colección y sus índices se conservan. No se puede deshacer.",
            confirmLabel: "Eliminar todos",
          },
          target,
          () => documents.deleteAll(target),
          onDone,
        ),
    };
  }, [documents, log, serverOf]);

  return (
    <DocumentActionsContext.Provider value={actions}>
      {children}
    </DocumentActionsContext.Provider>
  );
}
