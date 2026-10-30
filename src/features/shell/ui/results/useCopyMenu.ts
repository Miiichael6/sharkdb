import { useCallback, useState, type MouseEvent } from "react";
import type { ContextMenuItem } from "../../../../shared/ui/ContextMenu";
import { useLog } from "../../../../shared/ui/useLog";
import { formatValue, type DateZone } from "../../domain/bsonFormat";
import { dottedPath, type KeyPath } from "../../domain/resultView";

/** What was right-clicked: a value at `path` inside `doc`. */
export interface CopyTarget {
  doc: unknown;
  path: KeyPath;
  value: unknown;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

/** "Copiar valor / documento / ruta" menu of the result views, writing shell syntax to the clipboard. */
export function useCopyMenu(zone: DateZone) {
  const log = useLog();
  const [menu, setMenu] = useState<MenuState | null>(null);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch((e) => log.error("No se pudo copiar al portapapeles", e));
  };

  const open = (e: MouseEvent, target: CopyTarget) => {
    e.preventDefault();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "Copiar valor", onSelect: () => copy(formatValue(target.value, zone)) },
        { label: "Copiar documento", onSelect: () => copy(formatValue(target.doc, zone)) },
        { label: "Copiar ruta", onSelect: () => copy(dottedPath(target.path)), disabled: !target.path.length },
      ],
    });
  };

  const close = useCallback(() => setMenu(null), []);

  return { menu, open, close };
}
