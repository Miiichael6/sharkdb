import { useEffect, useMemo, useRef, useState } from "react";
import { useServices } from "../../../app/services";
import { errorMessage } from "../../../shared/errors";
import { ConfirmDialog } from "../../../shared/ui/common";
import { displayName } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import type { IndexSpec } from "../domain/mongo";
import { childKey, parentKey, serverNode, type NodeKind, type TreeNode } from "../domain/tree";
import { useTree } from "./useTree";
import { DetailPanel, type PanelMode } from "./DetailPanel";
import { IndexDialog, PromptDialog, type PromptField } from "./dialogs";
import { Explorer, type Action } from "./Explorer";

interface Props {
  sessions: Session[];
  onDisconnect: (sid: string) => void;
  onShowConnections: () => void;
}

type Dialog =
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
  | { kind: "confirm"; title: string; message: string; label: string; run: () => Promise<void> };

type Notice = { kind: "ok" | "error"; text: string } | null;

const PANEL_ACTIONS: Action[] = ["serverStatus", "hostInfo", "buildInfo", "dbStats", "collStats"];

export function Workspace({ sessions, onDisconnect, onShowConnections }: Props) {
  const roots = useMemo(
    () => sessions.map((s) => serverNode(s.conn.id, displayName(s.conn))),
    [sessions],
  );
  const { explorer } = useServices();
  const tree = useTree(roots, explorer.loadChildren);
  const [panel, setPanel] = useState<{ key: string; mode: PanelMode } | null>(null);
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [sidebarWidth, setSidebarWidth] = useState(320);

  const selected = tree.node(tree.selected) ?? roots[0];
  const mode: PanelMode = panel && panel.key === selected?.key ? panel.mode : "default";

  useEffect(() => {
    if (notice?.kind !== "ok") return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

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

  const indexesFolderKey = (n: TreeNode) =>
    n.kind === "indexes" ? n.key : n.kind === "index" ? parentKey(n.key)! : childKey(n.key, "indexes", "Indexes");

  const collectionsFolderKey = (n: TreeNode) =>
    ancestor(n, "collections")?.key ?? childKey(ancestor(n, "database")!.key, "collections", "Collections");

  const done = (text: string) => setNotice({ kind: "ok", text });

  const openIndexDialog = (n: TreeNode, initial?: IndexSpec) => setDialog({ kind: "index", node: n, initial });

  const confirmDropIndex = (n: TreeNode, ix: IndexSpec) =>
    setDialog({
      kind: "confirm",
      title: "Eliminar índice",
      message: `¿Eliminar el índice “${ix.name}” de ${n.coll}?`,
      label: "Eliminar",
      run: async () => {
        await explorer.dropIndex(n.sid, n.db!, n.coll!, ix.name);
        refreshKey(indexesFolderKey(n));
        done(`Índice “${ix.name}” eliminado`);
      },
    });

  const onAction = (action: Action, n: TreeNode) => {
    if (PANEL_ACTIONS.includes(action)) {
      tree.select(n.key);
      setPanel({ key: n.key, mode: action as PanelMode });
      return;
    }
    switch (action) {
      case "refresh":
        refreshKey(n.key);
        break;
      case "view":
        tree.select(n.key);
        setPanel(null);
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
            done(`Base de datos “${db}” creada`);
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
            done(`Colección “${name}” creada`);
          },
        });
        break;
      }
      case "dropDatabase":
        setDialog({
          kind: "confirm",
          title: "Eliminar base de datos",
          message: `¿Eliminar “${n.db}” y TODAS sus colecciones? No se puede deshacer.`,
          label: "Eliminar base de datos",
          run: async () => {
            await explorer.dropDatabase(n.sid, n.db!);
            tree.select(`server:${n.sid}`);
            refreshKey(`server:${n.sid}`);
            done(`Base de datos “${n.db}” eliminada`);
          },
        });
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
            done(`Colección renombrada a “${name}”`);
          },
        });
        break;
      case "dropCollection": {
        const what = n.data?.type === "view" ? "la vista" : "la colección";
        setDialog({
          kind: "confirm",
          title: `Eliminar ${what}`,
          message: `¿Eliminar ${what} “${n.db}.${n.coll}” con todos sus documentos? No se puede deshacer.`,
          label: "Eliminar",
          run: async () => {
            await explorer.dropCollection(n.sid, n.db!, n.coll!);
            tree.select(parentKey(n.key));
            refreshKey(collectionsFolderKey(n));
            done(`“${n.coll}” eliminada`);
          },
        });
        break;
      }
      case "addIndex":
        openIndexDialog(n);
        break;
      case "editIndex":
        openIndexDialog(n, n.data);
        break;
      case "dropIndex":
        confirmDropIndex(n, n.data);
        break;
      case "dropUser":
        setDialog({
          kind: "confirm",
          title: "Eliminar usuario",
          message: `¿Eliminar el usuario “${n.label}” de ${n.db}?`,
          label: "Eliminar",
          run: async () => {
            await explorer.dropUser(n.sid, n.db!, n.label);
            tree.select(parentKey(n.key));
            refreshKey(parentKey(n.key));
            done(`Usuario “${n.label}” eliminado`);
          },
        });
        break;
      case "removeFunction":
        setDialog({
          kind: "confirm",
          title: "Eliminar función",
          message: `¿Eliminar la función “${n.label}” de ${n.db}?`,
          label: "Eliminar",
          run: async () => {
            await explorer.removeFunction(n.sid, n.db!, n.label);
            tree.select(parentKey(n.key));
            refreshKey(parentKey(n.key));
            done(`Función “${n.label}” eliminada`);
          },
        });
        break;
    }
  };

  // Splitter between explorer and panel.
  const dragging = useRef(false);
  useEffect(() => {
    const move = (e: MouseEvent) => dragging.current && setSidebarWidth(Math.min(Math.max(e.clientX, 200), 640));
    const up = () => (dragging.current = false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  return (
    <div className="workspace">
      <header className="ws-header">
        <button onClick={onShowConnections} title="Abrir otra conexión">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Conexiones
        </button>
        <span className="muted">
          {sessions.length} {sessions.length === 1 ? "conexión abierta" : "conexiones abiertas"}
        </span>
        <span className="spacer" />
        <span className="muted small">Clic derecho en el árbol para más acciones · F5 refresca</span>
      </header>

      <div className="ws-body">
        <nav className="ws-sidebar" style={{ width: sidebarWidth }}>
          <Explorer tree={tree} onAction={onAction} />
        </nav>
        <div className="splitter" onMouseDown={() => (dragging.current = true)} />
        <main className="ws-main">
          {selected && (
            <DetailPanel
              node={selected}
              mode={mode}
              version={version}
              childCount={tree.children.get(selected.key)?.length}
              onAction={(m) => setPanel({ key: selected.key, mode: m })}
              onEditIndex={(ix) => openIndexDialog(selected, ix)}
              onDropIndex={(ix) => confirmDropIndex(selected, ix)}
            />
          )}
        </main>
      </div>

      {notice && (
        <div className={`notice ${notice.kind}`} role="status">
          <span>{notice.text}</span>
          <button className="ghost" onClick={() => setNotice(null)} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}

      {dialog?.kind === "prompt" && (
        <PromptDialog
          title={dialog.title}
          fields={dialog.fields}
          note={dialog.note}
          confirmLabel={dialog.confirmLabel}
          onSubmit={dialog.submit}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === "index" && (
        <IndexDialog
          collection={dialog.node.coll!}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onSubmit={async (spec) => {
            const n = dialog.node;
            const coll = ancestor(n, "collection");
            if (dialog.initial) await explorer.replaceIndex(n.sid, n.db!, n.coll!, dialog.initial, spec);
            else await explorer.createIndex(n.sid, n.db!, n.coll!, spec);
            setDialog(null);
            if (coll) tree.expand(coll);
            refreshKey(indexesFolderKey(n));
            done(`Índice “${spec.name}” ${dialog.initial ? "actualizado" : "creado"}`);
          }}
        />
      )}

      {dialog?.kind === "confirm" && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.label}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const { run } = dialog;
            setDialog(null);
            run().catch((e) => setNotice({ kind: "error", text: errorMessage(e) }));
          }}
        />
      )}
    </div>
  );
}
