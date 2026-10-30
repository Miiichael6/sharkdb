import { useState } from "react";
import { useServices } from "../../../app/services";
import type { ConfirmRequest } from "../../../shared/domain/confirmation";
import { confirmInWindow } from "../../../shared/ui/confirmInWindow";
import { useDocumentActions } from "../../../shared/ui/documentActions";
import { duplicateName, type CopyRequest } from "../domain/copySpec";
import type { IndexSpec, UserEntry } from "../domain/mongo";
import type { UserSpec } from "../domain/userSpec";
import { childKey, parentKey, type NodeKind, type TreeNode } from "../domain/tree";
import type { PanelMode } from "./DetailPanel";
import type { PromptField } from "./dialogs";
import type { Action } from "./Explorer";
import type { Tree } from "./useTree";

export type ExplorerDialog =
  | null
  | {
      kind: "prompt";
      title: string;
      fields: PromptField[];
      confirmLabel: string;
      note?: string;
      submit: (v: Record<string, string>) => Promise<void>;
    }
  | { kind: "index"; node: TreeNode; initial?: IndexSpec }
  | { kind: "user"; node: TreeNode; initial?: UserEntry }
  | { kind: "copy"; node: TreeNode };

const PANEL_ACTIONS: Action[] = ["serverStatus", "hostInfo", "buildInfo", "dbStats", "collStats"];

interface Options {
  tree: Tree;
  onDisconnect: (sid: string) => void;
  /** Shows `mode` in the detail panel for node `key`; null goes back to the default view. */
  showPanel: (key: string, mode: PanelMode | null) => void;
  notify: (text: string) => void;
  fail: (e: unknown) => void;
}

/** Turns a context-menu action on a tree node into a dialog, a service call or a panel change. */
export function useExplorerActions({ tree, onDisconnect, showPanel, notify, fail }: Options) {
  const { explorer } = useServices();
  const documents = useDocumentActions();
  const [dialog, setDialog] = useState<ExplorerDialog>(null);
  // Bumped after every change so the detail panel reloads what it shows.
  const [version, setVersion] = useState(0);

  const closeDialog = () => setDialog(null);

  const ancestor = (n: TreeNode, kind: NodeKind): TreeNode | undefined => {
    for (let k: string | null = n.key; k; k = parentKey(k)) {
      const node = tree.node(k);
      if (node?.kind === kind) return node;
    }
  };

  const refreshKey = (key: string | null | undefined) => {
    const n = tree.node(key ?? null);
    if (n) tree.refresh(n);
    setVersion((v) => v + 1);
  };

  /** Refresh workspace: the whole tree plus the detail panel. */
  const refreshAll = () => {
    tree.refreshAll();
    setVersion((v) => v + 1);
  };

  const indexesFolderKey = (n: TreeNode) =>
    n.kind === "indexes" ? n.key : n.kind === "index" ? parentKey(n.key)! : childKey(n.key, "indexes", "Indexes");

  const collectionsFolderKey = (n: TreeNode) =>
    ancestor(n, "collections")?.key ?? childKey(ancestor(n, "database")!.key, "collections", "Collections");

  const usersFolderKey = (n: TreeNode) => (n.kind === "users" ? n.key : parentKey(n.key));

  const editIndex = (n: TreeNode, initial?: IndexSpec) => setDialog({ kind: "index", node: n, initial });

  /** Asks in its own window and, if confirmed, runs the action, reporting its failure. */
  const confirmThen = async (request: ConfirmRequest, run: () => Promise<void>) => {
    if (await confirmInWindow(request)) await run().catch(fail);
  };

  const dropIndex = (n: TreeNode, ix: IndexSpec) =>
    void confirmThen(
      { title: "Eliminar índice", message: `¿Eliminar el índice “${ix.name}” de ${n.coll}?`, confirmLabel: "Eliminar" },
      async () => {
        await explorer.dropIndex(n.sid, n.db!, n.coll!, ix.name);
        refreshKey(indexesFolderKey(n));
        notify(`Índice “${ix.name}” eliminado`);
      },
    );

  /** Confirmation whose action removes `n` and leaves its parent selected and refreshed. */
  const confirmRemoval = (n: TreeNode, title: string, message: string, refresh: string | null, run: () => Promise<void>, doneText: string) =>
    void confirmThen({ title, message, confirmLabel: "Eliminar" }, async () => {
      await run();
      tree.select(parentKey(n.key));
      refreshKey(refresh);
      notify(doneText);
    });

  const submitIndex = async (spec: IndexSpec) => {
    if (dialog?.kind !== "index") return;
    const { node: n, initial } = dialog;
    const coll = ancestor(n, "collection");
    if (initial) await explorer.replaceIndex(n.sid, n.db!, n.coll!, initial, spec);
    else await explorer.createIndex(n.sid, n.db!, n.coll!, spec);
    setDialog(null);
    if (coll) tree.expand(coll);
    refreshKey(indexesFolderKey(n));
    notify(`Índice “${spec.name}” ${initial ? "actualizado" : "creado"}`);
  };

  const submitUser = async (spec: UserSpec) => {
    if (dialog?.kind !== "user") return;
    const { node: n, initial } = dialog;
    if (initial) await explorer.updateUser(n.sid, n.db!, spec);
    else await explorer.createUser(n.sid, n.db!, spec);
    setDialog(null);
    refreshKey(usersFolderKey(n));
    notify(`Usuario “${spec.user}” ${initial ? "actualizado" : "creado"}`);
  };

  const submitCopy = async (request: CopyRequest) => {
    const copied = await explorer.copyCollection(request);
    setDialog(null);
    // The target may be a new database: reload what is open.
    refreshAll();
    const { db, coll } = request.target;
    notify(`“${request.source.coll}” copiada a ${db.trim()}.${coll.trim()} (${copied.toLocaleString()} documentos)`);
  };

  const onAction = (action: Action, n: TreeNode) => {
    if (PANEL_ACTIONS.includes(action)) {
      tree.select(n.key);
      showPanel(n.key, action as PanelMode);
      return;
    }
    switch (action) {
      case "refresh":
        refreshKey(n.key);
        break;
      case "view":
        tree.select(n.key);
        showPanel(n.key, null);
        break;
      case "disconnect":
        onDisconnect(n.sid);
        break;
      case "createDatabase":
        setDialog({
          kind: "prompt",
          title: "Crear base de datos",
          fields: [
            { name: "db", label: "Nombre de la base de datos" },
            { name: "coll", label: "Primera colección" },
          ],
          note: "MongoDB crea la base de datos al crear su primera colección.",
          confirmLabel: "Crear",
          submit: async ({ db, coll }) => {
            await explorer.createCollection(n.sid, db, coll);
            setDialog(null);
            refreshKey(n.key);
            notify(`Base de datos “${db}” creada`);
          },
        });
        break;
      case "createCollection": {
        const db = n.db!;
        setDialog({
          kind: "prompt",
          title: `Crear colección en ${db}`,
          fields: [{ name: "name", label: "Nombre" }],
          confirmLabel: "Crear",
          submit: async ({ name }) => {
            await explorer.createCollection(n.sid, db, name);
            setDialog(null);
            refreshKey(collectionsFolderKey(n));
            notify(`Colección “${name}” creada`);
          },
        });
        break;
      }
      case "dropDatabase":
        void confirmThen(
          {
            title: "Eliminar base de datos",
            message: `¿Eliminar “${n.db}” y TODAS sus colecciones? No se puede deshacer.`,
            confirmLabel: "Eliminar base de datos",
          },
          async () => {
            await explorer.dropDatabase(n.sid, n.db!);
            tree.select(`server:${n.sid}`);
            refreshKey(`server:${n.sid}`);
            notify(`Base de datos “${n.db}” eliminada`);
          },
        );
        break;
      case "renameCollection":
        setDialog({
          kind: "prompt",
          title: "Renombrar colección",
          fields: [{ name: "name", label: "Nuevo nombre", initial: n.coll }],
          confirmLabel: "Renombrar",
          submit: async ({ name }) => {
            await explorer.renameCollection(n.sid, n.db!, n.coll!, name);
            setDialog(null);
            tree.select(parentKey(n.key));
            refreshKey(collectionsFolderKey(n));
            notify(`Colección renombrada a “${name}”`);
          },
        });
        break;
      case "dropCollection": {
        const what = n.data?.type === "view" ? "la vista" : "la colección";
        confirmRemoval(
          n,
          `Eliminar ${what}`,
          `¿Eliminar ${what} “${n.db}.${n.coll}” con todos sus documentos? No se puede deshacer.`,
          collectionsFolderKey(n),
          () => explorer.dropCollection(n.sid, n.db!, n.coll!),
          `“${n.coll}” eliminada`,
        );
        break;
      }
      case "insertDocument":
        documents.insert({ sid: n.sid, db: n.db!, coll: n.coll! }, () => refreshKey(null));
        break;
      case "removeAllDocuments":
        documents.removeAll({ sid: n.sid, db: n.db!, coll: n.coll! }, () => refreshKey(null));
        break;
      case "addIndex":
        editIndex(n);
        break;
      case "editIndex":
        editIndex(n, n.data);
        break;
      case "rebuildIndexes":
        void confirmThen(
          {
            title: "Reconstruir índices",
            message: `¿Reconstruir todos los índices de ${n.db}.${n.coll}? La colección queda bloqueada mientras dura.`,
            confirmLabel: "Reconstruir",
          },
          async () => {
            await explorer.rebuildIndexes(n.sid, n.db!, n.coll!);
            refreshKey(indexesFolderKey(n));
            notify(`Índices de “${n.coll}” reconstruidos`);
          },
        );
        break;
      case "dropIndex":
        dropIndex(n, n.data);
        break;
      case "addUser":
        setDialog({ kind: "user", node: n });
        break;
      case "editUser":
        setDialog({ kind: "user", node: n, initial: n.data });
        break;
      case "copyCollection":
        setDialog({ kind: "copy", node: n });
        break;
      case "duplicateCollection":
        setDialog({
          kind: "prompt",
          title: `Duplicar ${n.db}.${n.coll}`,
          fields: [{ name: "name", label: "Nombre de la copia", initial: duplicateName(n.coll!) }],
          note: "Se copian los documentos y los índices en la misma base de datos.",
          confirmLabel: "Duplicar",
          submit: async ({ name }) => {
            const copied = await explorer.duplicateCollection({ sid: n.sid, db: n.db!, coll: n.coll! }, name);
            setDialog(null);
            refreshKey(collectionsFolderKey(n));
            notify(`“${n.coll}” duplicada como “${name.trim()}” (${copied.toLocaleString()} documentos)`);
          },
        });
        break;
      case "dropUser":
        confirmRemoval(
          n,
          "Eliminar usuario",
          `¿Eliminar el usuario “${n.label}” de ${n.db}?`,
          parentKey(n.key),
          () => explorer.dropUser(n.sid, n.db!, n.label),
          `Usuario “${n.label}” eliminado`,
        );
        break;
      case "removeFunction":
        confirmRemoval(
          n,
          "Eliminar función",
          `¿Eliminar la función “${n.label}” de ${n.db}?`,
          parentKey(n.key),
          () => explorer.removeFunction(n.sid, n.db!, n.label),
          `Función “${n.label}” eliminada`,
        );
        break;
    }
  };

  return {
    dialog,
    closeDialog,
    version,
    onAction,
    editIndex,
    dropIndex,
    submitIndex,
    submitUser,
    submitCopy,
    refreshAll,
  };
}
