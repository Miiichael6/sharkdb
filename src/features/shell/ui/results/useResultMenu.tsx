import { useCallback, useState, type MouseEvent } from "react";
import type { ContextMenuItem } from "../../../../shared/ui/ContextMenu";
import { useLog } from "../../../../shared/ui/useLog";
import { formatValue, type DateZone } from "../../domain/bsonFormat";
import { dottedPath, valueText, type KeyPath } from "../../domain/resultView";
import { ResultMenuIcon, type ResultMenuAction } from "./ResultMenuIcon";

/** What was right-clicked: a value at `path` inside `doc`. */
export interface ResultTarget {
  doc: unknown;
  path: KeyPath;
  value: unknown;
  /** Only in the tree view: opens or closes the clicked row and everything below it. */
  tree?: { expandable: boolean; expand: () => void; collapse: () => void };
}

/** Entries a cursor result adds for the clicked document. */
export interface DocumentEntries {
  manage: ContextMenuItem[];
  remove: ContextMenuItem[];
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

/** A menu item with its icon. */
export const resultItem = (
  action: ResultMenuAction,
  label: string,
  onSelect: () => void,
  extra: Partial<ContextMenuItem> = {},
): ContextMenuItem => ({ label, onSelect, icon: <ResultMenuIcon action={action} />, ...extra });

/** Joins the non-empty sections, a separator line between each two. */
const withSeparators = (sections: ContextMenuItem[][]) =>
  sections
    .filter((s) => s.length)
    .flatMap((s) => s.map((item, i) => (i === 0 ? { ...item, separatorBefore: true } : item)));

/**
 * Right-click menu of the result views, in Robo 3T's order: expand / collapse (tree), the document
 * entries `documentEntries` adds, the copy entries (dates in the view's zone) and deleting the document.
 */
export function useResultMenu(zone: DateZone, documentEntries?: (target: ResultTarget) => DocumentEntries) {
  const log = useLog();
  const [menu, setMenu] = useState<MenuState | null>(null);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch((e) => log.error("No se pudo copiar al portapapeles", e));
  };

  const open = (e: MouseEvent, target: ResultTarget) => {
    e.preventDefault();
    const { tree, path } = target;
    const isRoot = !path.length;
    const treeItems = tree
      ? [
          resultItem("expand", "Expandir recursivamente", tree.expand, { disabled: !tree.expandable }),
          resultItem("collapse", "Colapsar recursivamente", tree.collapse, { disabled: !tree.expandable }),
        ]
      : [];
    const copyItems = [
      resultItem("copyValue", "Copiar valor", () => copy(valueText(target.value, zone))),
      resultItem("copyName", "Copiar nombre", () => copy(path[path.length - 1]), { disabled: isRoot }),
      resultItem("copyPath", "Copiar ruta", () => copy(dottedPath(path)), { disabled: isRoot }),
      resultItem("copyJson", "Copiar JSON", () => copy(formatValue(target.value, zone))),
    ];
    const documentItems = documentEntries?.(target);
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: withSeparators([treeItems, documentItems?.manage ?? [], copyItems, documentItems?.remove ?? []]),
    });
  };

  const close = useCallback(() => setMenu(null), []);

  return { menu, open, close };
}
