import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SAFE_MODE_ERROR } from "../../connections/domain/safeMode";
import type { MenuScriptKind } from "../../shell/domain/menuScripts";
import { useReadOnly } from "../../connections/ui/useReadOnly";
import { Spinner } from "../../../shared/ui/common";
import { MenuList } from "../../../shared/ui/MenuList";
import { FOLDER_KINDS, isLeaf, parentKey, type TreeNode } from "../domain/tree";
import { blockedInSafeMode } from "../domain/writeActions";
import { NodeIcon } from "./NodeIcon";
import type { Tree } from "./useTree";

export type Action =
  | "openShell"
  | "openMongosh"
  | "refresh"
  | "createDatabase"
  | "serverStatus"
  | "hostInfo"
  | "buildInfo"
  | "disconnect"
  | "dbStats"
  | "createCollection"
  | "dropDatabase"
  | "collStats"
  | "addIndex"
  | "insertDocument"
  | "removeAllDocuments"
  | "renameCollection"
  | "dropCollection"
  | "editIndex"
  | "dropIndex"
  | "rebuildIndexes"
  | "view"
  | "addUser"
  | "editUser"
  | "dropUser"
  | "copyCollection"
  | "duplicateCollection"
  | "removeFunction"
  | "backupDatabase"
  | "restoreDatabase"
  | "syncDatabase"
  | MenuScriptKind;

type MenuItem = { label: string; action: Action; danger?: boolean; disabled?: boolean } | "sep";

// Same order as Robo 3T's context menus, minus the actions that aren't built yet.
function menuFor(n: TreeNode): MenuItem[] {
  switch (n.kind) {
    case "server":
      return [
        { label: "Abrir shell", action: "openShell" },
        { label: "Abrir en mongosh", action: "openMongosh" },
        { label: "Refrescar", action: "refresh" },
        { label: "Crear base de datos…", action: "createDatabase" },
        "sep",
        { label: "Estado del servidor", action: "serverStatus" },
        { label: "Info del host", action: "hostInfo" },
        { label: "Versión de MongoDB", action: "buildInfo" },
        "sep",
        { label: "Ver log", action: "showLog" },
        { label: "Desconectar", action: "disconnect" },
      ];
    case "systemDbs":
      return [];
    case "database":
      return [
        { label: "Abrir shell", action: "openShell" },
        { label: "Abrir en mongosh", action: "openMongosh" },
        { label: "Refrescar", action: "refresh" },
        { label: "Estadísticas", action: "dbStats" },
        "sep",
        { label: "Crear colección…", action: "createCollection" },
        { label: "Eliminar base de datos…", action: "dropDatabase", danger: true },
        "sep",
        { label: "Backup…", action: "backupDatabase" },
        { label: "Restaurar…", action: "restoreDatabase" },
        { label: "Sincronizar con otro entorno…", action: "syncDatabase" },
      ];
    case "collections":
      return [
        { label: "Crear colección…", action: "createCollection" },
        { label: "Refrescar", action: "refresh" },
      ];
    case "collection":
      if (n.data?.type === "view") {
        return [
          { label: "Abrir shell", action: "openShell" },
          { label: "Ver definición", action: "view" },
          { label: "Eliminar vista…", action: "dropCollection", danger: true },
        ];
      }
      return [
        { label: "Ver documentos", action: "viewDocuments" },
        "sep",
        { label: "Insertar documento…", action: "insertDocument" },
        { label: "Actualizar documentos…", action: "updateDocuments" },
        { label: "Eliminar documentos…", action: "removeDocuments" },
        { label: "Eliminar todos los documentos…", action: "removeAllDocuments", danger: true },
        "sep",
        { label: "Renombrar colección…", action: "renameCollection" },
        { label: "Duplicar colección…", action: "duplicateCollection" },
        { label: "Copiar colección a base de datos…", action: "copyCollection" },
        { label: "Eliminar colección…", action: "dropCollection", danger: true },
        "sep",
        { label: "Backup…", action: "backupDatabase" },
        { label: "Restaurar…", action: "restoreDatabase" },
        { label: "Sincronizar con otro entorno…", action: "syncDatabase" },
        "sep",
        { label: "Estadísticas", action: "collStats" },
        { label: "Añadir índice…", action: "addIndex" },
        "sep",
        { label: "Versión de shard", action: "shardVersion" },
        { label: "Distribución de shards", action: "shardDistribution" },
      ];
    case "indexes":
      return [
        { label: "Ver índices", action: "viewIndexes" },
        { label: "Añadir índice…", action: "addIndex" },
        { label: "Reconstruir índices…", action: "rebuildIndexes" },
        "sep",
        { label: "Refrescar", action: "refresh" },
      ];
    case "index": {
      const isId = n.label === "_id_";
      return [
        { label: "Editar índice…", action: "editIndex", disabled: isId },
        { label: "Eliminar índice…", action: "dropIndex", danger: true, disabled: isId },
      ];
    }
    case "users":
      return [
        { label: "Añadir usuario…", action: "addUser" },
        { label: "Refrescar", action: "refresh" },
      ];
    case "functions":
    case "systemCollections":
      return [{ label: "Refrescar", action: "refresh" }];
    case "user":
      return [
        { label: "Ver usuario", action: "view" },
        { label: "Editar usuario…", action: "editUser" },
        { label: "Eliminar usuario…", action: "dropUser", danger: true },
      ];
    case "function":
      return [
        { label: "Ver función", action: "view" },
        { label: "Eliminar función…", action: "removeFunction", danger: true },
      ];
  }
}

interface Props {
  tree: Tree;
  onAction: (action: Action, node: TreeNode) => void;
}

export function Explorer({ tree, onAction }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const isReadOnly = useReadOnly();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  // Keep the selected row in view while moving with the keyboard.
  useEffect(() => {
    rootRef.current?.querySelector(".tree-row.selected")?.scrollIntoView({ block: "nearest" });
  }, [tree.selected]);

  const onKeyDown = (e: KeyboardEvent) => {
    const current = tree.node(tree.selected);
    const rows = tree.visible();
    const i = current ? rows.findIndex((r) => r.key === current.key) : -1;
    const go = (n?: TreeNode) => n && tree.select(n.key);

    switch (e.key) {
      case "ArrowDown":
        go(rows[Math.min(i + 1, rows.length - 1)]);
        break;
      case "ArrowUp":
        go(rows[Math.max(i - 1, 0)]);
        break;
      case "ArrowRight":
        if (!current || isLeaf(current)) break;
        if (!tree.expanded.has(current.key)) tree.expand(current);
        else go(tree.children.get(current.key)?.[0]);
        break;
      case "ArrowLeft":
        if (!current) break;
        if (tree.expanded.has(current.key)) tree.collapse(current);
        else go(tree.node(parentKey(current.key)));
        break;
      case "Enter":
        if (current) tree.toggle(current);
        break;
      case "F5":
        if (current) onAction("refresh", current);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const renderNode = (n: TreeNode, depth: number): ReactNode => {
    const open = tree.expanded.has(n.key);
    const kids = tree.children.get(n.key);
    const leaf = isLeaf(n);
    const count = kids && (n.kind === "server" || FOLDER_KINDS.includes(n.kind)) ? countOf(kids) : null;
    const error = tree.errors.get(n.key);

    return (
      <li key={n.key} role="treeitem" aria-expanded={leaf ? undefined : open}>
        <div
          className={`tree-row ${tree.selected === n.key ? "selected" : ""}`}
          style={{ paddingLeft: 6 + depth * 16 }}
          onClick={() => tree.select(n.key)}
          // Like Robo 3T, double clicking a collection opens a shell with its default query.
          onDoubleClick={() => (n.kind === "collection" ? onAction("openShell", n) : tree.toggle(n))}
          onContextMenu={(e) => {
            e.preventDefault();
            tree.select(n.key);
            if (menuFor(n).length) setMenu({ x: e.clientX, y: e.clientY, node: n });
          }}
        >
          <span
            className={`chevron ${open ? "open" : ""} ${leaf ? "hidden" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              tree.toggle(n);
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path d="M3 1.5 6.5 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          <NodeIcon kind={n.kind} view={n.data?.type === "view"} open={open} />
          <span className="tree-label" title={n.label}>
            {n.label}
          </span>
          {count !== null && <span className="tree-count">({count})</span>}
          {n.kind === "index" && <span className="tree-detail">{JSON.stringify(n.data.key)}</span>}
          {n.kind === "collection" && n.data?.type === "view" && <span className="tree-detail">vista</span>}
          {tree.loading.has(n.key) && <Spinner />}
        </div>
        {open && error && (
          <div className="tree-error" style={{ paddingLeft: 26 + depth * 16 }} title={error}>
            {error}
          </div>
        )}
        {open && kids && kids.length > 0 && (
          <ul role="group">{kids.map((k) => renderNode(k, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <div className="explorer" ref={rootRef} tabIndex={0} onKeyDown={onKeyDown}>
      <ul role="tree" aria-label="Explorador">
        {tree.roots.map((r) => renderNode(r, 0))}
      </ul>

      {menu && (
        <MenuList x={menu.x} y={menu.y}>
          {menuFor(menu.node).map((item, i) => {
            if (item === "sep") return <li key={i} className="sep" />;
            const blocked = isReadOnly(menu.node.sid) && blockedInSafeMode(item.action);
            const disabled = item.disabled || blocked;
            return (
              <li
                key={item.action}
                className={`${item.danger ? "danger" : ""} ${disabled ? "disabled" : ""}`}
                title={blocked ? SAFE_MODE_ERROR : undefined}
                onClick={() => !disabled && onAction(item.action, menu.node)}
              >
                {item.label}
              </li>
            );
          })}
        </MenuList>
      )}
    </div>
  );
}

/** Folders that hold preset children (System) count as their contents, like Robo 3T. */
function countOf(kids: TreeNode[]): number {
  return kids.reduce((n, k) => n + (k.data?.children ? k.data.children.length : 1), 0);
}
