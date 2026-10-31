import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SAFE_MODE_ERROR } from "../../connections/domain/safeMode";
import { useReadOnly } from "../../connections/ui/useReadOnly";
import { Spinner } from "../../../shared/ui/common";
import { MenuList } from "../../../shared/ui/MenuList";
import { MISSING_DATABASE } from "../domain/pinnedDatabases";
import { FOLDER_KINDS, isLeaf, isMissingDatabase, parentKey, type TreeNode } from "../domain/tree";
import { blockedInSafeMode } from "../domain/writeActions";
import { menuFor, type Action } from "./explorerMenu";
import { NodeIcon } from "./NodeIcon";
import { useCollectionDrag } from "./useCollectionDrag";
import type { Tree } from "./useTree";

export type { Action } from "./explorerMenu";

interface Props {
  tree: Tree;
  onAction: (action: Action, node: TreeNode) => void;
  /** Ctrl+Enter on a collection: runs its shell tab (opening one if it has none). */
  onRunCollection?: (node: TreeNode) => void;
  /** A collection is being dragged out of the tree (null once dropped). */
  onDragCollection?: (node: TreeNode | null) => void;
}

export function Explorer({ tree, onAction, onRunCollection, onDragCollection }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const isReadOnly = useReadOnly();
  const rootRef = useRef<HTMLDivElement>(null);
  const dragStart = useCollectionDrag(onDragCollection);

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
        if (e.ctrlKey || e.metaKey) {
          if (current?.kind === "collection") onRunCollection?.(current);
        } else if (current) tree.toggle(current);
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
    const missing = isMissingDatabase(n);

    return (
      <li key={n.key} role="treeitem" aria-expanded={leaf ? undefined : open}>
        <div
          className={`tree-row ${tree.selected === n.key ? "selected" : ""} ${missing ? "missing" : ""}`}
          style={{ paddingLeft: 6 + depth * 16 }}
          onClick={() => tree.select(n.key)}
          onPointerDown={dragStart(n)}
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
          <span className="tree-label" title={missing ? `${n.label}: ${MISSING_DATABASE}` : n.label}>
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
          {menuFor(menu.node).map((item, i, items) => {
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
                {items.some((x) => x !== "sep" && x.icon) && <span className="menu-icon">{item.icon}</span>}
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
