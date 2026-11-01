// Keyboard navigation of the explorer tree, plus Ctrl+F to the selected database's collection filter.
import { useCallback, useState, type KeyboardEvent } from "react";
import { showsFilter } from "../domain/collectionFilter";
import { childNode, isLeaf, parentKey, type TreeNode } from "../domain/tree";
import type { Action } from "./explorerMenu";
import type { Tree } from "./useTree";

interface Handlers {
  onAction: (action: Action, node: TreeNode) => void;
  onRunCollection?: (node: TreeNode) => void;
}

export function useTreeKeyboard(tree: Tree, { onAction, onRunCollection }: Handlers) {
  // `Collections` folder whose filter box Ctrl+F asked to focus.
  const [filterFocus, setFilterFocus] = useState<string | null>(null);
  const clearFilterFocus = useCallback(() => setFilterFocus(null), []);

  /** Opens the `Collections` folder of `n`'s database and asks its filter box for the focus. */
  const focusFilter = (n: TreeNode | undefined) => {
    const db = n && tree.ancestor(n, "database");
    if (!n || !db) return;
    const folder = tree.ancestor(n, "collections") ?? childNode(db, "collections", "Collections");
    const kids = tree.children.get(folder.key);
    tree.reveal(folder);
    if (!kids || showsFilter(kids)) setFilterFocus(folder.key);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const current = tree.node(tree.selected);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      focusFilter(current);
      return;
    }
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
        else go(tree.shownChildren(current.key)?.[0]);
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

  return { onKeyDown, filterFocus, clearFilterFocus };
}
