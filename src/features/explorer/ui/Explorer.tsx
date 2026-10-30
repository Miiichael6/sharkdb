import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Spinner } from "../../../shared/ui/common";
import { FOLDER_KINDS, isLeaf, parentKey, type NodeKind, type TreeNode } from "../domain/tree";
import type { Tree } from "./useTree";

export type Action =
  | "openShell"
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
  | "view"
  | "dropUser"
  | "removeFunction";

type MenuItem = { label: string; action: Action; danger?: boolean; disabled?: boolean } | "sep";

// Same order as Robo 3T's context menus, minus the actions that aren't built yet.
function menuFor(n: TreeNode): MenuItem[] {
  switch (n.kind) {
    case "server":
      return [
        { label: "Abrir shell", action: "openShell" },
        { label: "Refrescar", action: "refresh" },
        { label: "Crear base de datos…", action: "createDatabase" },
        "sep",
        { label: "Estado del servidor", action: "serverStatus" },
        { label: "Info del host", action: "hostInfo" },
        { label: "Versión de MongoDB", action: "buildInfo" },
        "sep",
        { label: "Desconectar", action: "disconnect" },
      ];
    case "systemDbs":
      return [];
    case "database":
      return [
        { label: "Abrir shell", action: "openShell" },
        { label: "Refrescar", action: "refresh" },
        { label: "Estadísticas", action: "dbStats" },
        "sep",
        { label: "Crear colección…", action: "createCollection" },
        { label: "Eliminar base de datos…", action: "dropDatabase", danger: true },
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
        { label: "Abrir shell", action: "openShell" },
        { label: "Estadísticas", action: "collStats" },
        { label: "Insertar documento…", action: "insertDocument" },
        { label: "Añadir índice…", action: "addIndex" },
        "sep",
        { label: "Renombrar colección…", action: "renameCollection" },
        { label: "Eliminar todos los documentos…", action: "removeAllDocuments", danger: true },
        { label: "Eliminar colección…", action: "dropCollection", danger: true },
      ];
    case "indexes":
      return [
        { label: "Añadir índice…", action: "addIndex" },
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
    case "functions":
    case "systemCollections":
      return [{ label: "Refrescar", action: "refresh" }];
    case "user":
      return [
        { label: "Ver usuario", action: "view" },
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
          <span className="tree-label">{n.label}</span>
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
        <ul className="context-menu" style={{ left: menu.x, top: menu.y }}>
          {menuFor(menu.node).map((item, i) =>
            item === "sep" ? (
              <li key={i} className="sep" />
            ) : (
              <li
                key={item.action}
                className={`${item.danger ? "danger" : ""} ${item.disabled ? "disabled" : ""}`}
                onClick={() => !item.disabled && onAction(item.action, menu.node)}
              >
                {item.label}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

/** Folders that hold preset children (System) count as their contents, like Robo 3T. */
function countOf(kids: TreeNode[]): number {
  return kids.reduce((n, k) => n + (k.data?.children ? k.data.children.length : 1), 0);
}

function NodeIcon({ kind, view, open }: { kind: NodeKind; view: boolean; open: boolean }) {
  const p = { width: 15, height: 15, viewBox: "0 0 16 16", "aria-hidden": true, className: `icon icon-${kind}` };
  switch (kind) {
    case "server":
      return (
        <svg {...p}>
          <rect x="1.5" y="2.5" width="13" height="8.5" rx="1.2" fill="none" stroke="currentColor" />
          <path d="M5 14h6M8 11v3" stroke="currentColor" />
        </svg>
      );
    case "database":
      return (
        <svg {...p}>
          <ellipse cx="8" cy="3.5" rx="5.5" ry="2" fill="none" stroke="currentColor" />
          <path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" fill="none" stroke="currentColor" />
        </svg>
      );
    case "collection":
      return view ? (
        <svg {...p}>
          <path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z" fill="none" stroke="currentColor" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </svg>
      ) : (
        <svg {...p}>
          <rect x="2" y="2" width="12" height="12" rx="1.2" fill="none" stroke="currentColor" />
          <path d="M2 6h12M2 10h12M6 6v8" stroke="currentColor" />
        </svg>
      );
    case "index":
      return (
        <svg {...p}>
          <circle cx="5" cy="8" r="3" fill="none" stroke="currentColor" />
          <path d="M8 8h7M12.5 8v3M14.5 8v2" stroke="currentColor" />
        </svg>
      );
    case "user":
      return (
        <svg {...p}>
          <circle cx="8" cy="5" r="3" fill="none" stroke="currentColor" />
          <path d="M2.5 15c0-3 2.5-5 5.5-5s5.5 2 5.5 5" fill="none" stroke="currentColor" />
        </svg>
      );
    case "function":
      return (
        <svg {...p}>
          <text x="3" y="13" fontSize="13" fontStyle="italic" fontFamily="serif" fill="currentColor">
            f
          </text>
        </svg>
      );
    default:
      return (
        <svg {...p}>
          {open ? (
            <path d="M1.5 4V13h11l2.5-6H4L1.5 13M1.5 4V3h4.5l1.5 1.5H12V7" fill="none" stroke="currentColor" />
          ) : (
            <path d="M1.5 3h4.5l1.5 1.5h7v8.5h-13Z" fill="none" stroke="currentColor" />
          )}
        </svg>
      );
  }
}
