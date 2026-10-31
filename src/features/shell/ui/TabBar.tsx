import { useEffect, useRef, useState } from "react";
import { MenuList } from "../../../shared/ui/MenuList";
import type { BarEntry } from "../domain/splitTabs";
import { TabFace } from "./TabFace";
import { useActivePill } from "./useActivePill";
import { useTabDrag, type TabDragOut } from "./useTabDrag";

interface Props {
  entries: BarEntry[];
  /** Active entry; null while the detail panel is shown. */
  activeId: string | null;
  onActivate: (id: string) => void;
  /** Closes an entry (both panes of a split). */
  onClose: (entry: BarEntry) => void;
  /** Duplicate and rename work on a tab: a split's active pane. */
  onDuplicate: (tabId: string) => void;
  onRename: (tabId: string, title: string) => void;
  onMove: (id: string, to: number) => void;
  onSeparate: (id: string) => void;
  /** A tab dragged out of the bar, onto the shell area. */
  dragOut: TabDragOut;
}

const MIDDLE_BUTTON = 1;

/** The tab an entry's tab actions work on: a split's active pane. */
const focusedPane = (entry: BarEntry) => entry.panes[entry.activePane];

/**
 * Shell tabs as a segmented control: equal-width tabs on a rounded track, the active one raised by a
 * highlight that slides between them. Drag reorders (or, out of the bar, splits), double click
 * renames, middle click closes.
 */
export function TabBar({ entries, activeId, onActivate, onClose, onDuplicate, onRename, onMove, onSeparate, dragOut }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; entry: BarEntry } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const ids = entries.map((e) => e.id);
  const drag = useTabDrag({ track, ids, onMove, out: dragOut });
  const { pill, ready } = useActivePill(track, activeId, ids.join());

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const finishRename = (tabId: string, title: string) => {
    onRename(tabId, title);
    setEditing(null);
  };

  if (!entries.length) return null;
  return (
    <div className="tab-bar">
      <div ref={track} className="tab-track" role="tablist" aria-label="Pestañas">
        {pill && (
          <span
            aria-hidden
            className={`tab-pill ${ready ? "ready" : ""} ${drag.draggingId === activeId ? "hidden" : ""}`}
            style={{ transform: `translateX(${pill.left}px)`, width: pill.width }}
          />
        )}
        {entries.map((entry) => {
          const selected = entry.id === activeId;
          const pane = focusedPane(entry);
          const dragged = drag.draggingId === entry.id;
          return (
            <div
              key={entry.id}
              role="tab"
              aria-selected={selected}
              data-tab-id={entry.id}
              className={`tab ${selected ? "active" : ""} ${dragged ? "dragging" : ""} ${dragged && drag.outside ? "out" : ""}`}
              title={entry.panes.map((t) => t.filePath ?? `${t.serverLabel} · ${t.db}`).join("\n")}
              onPointerDown={drag.onPointerDown(entry.id)}
              onClick={() => drag.consumeClick() || onActivate(entry.id)}
              onDoubleClick={() => setEditing(entry.id)}
              onMouseDown={(e) => e.button === MIDDLE_BUTTON && (e.preventDefault(), onClose(entry))}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, entry });
              }}
            >
              {editing === entry.id ? (
                <input
                  className="tab-rename"
                  defaultValue={pane.title}
                  autoFocus
                  onBlur={(e) => finishRename(pane.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishRename(pane.id, e.currentTarget.value);
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <TabFace entry={entry} />
              )}
              <button
                className="tab-close"
                aria-label={`Cerrar ${entry.panes.map((t) => t.title).join(" | ")}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(entry);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {menu && (
        <MenuList x={menu.x} y={menu.y}>
          <li onClick={() => onDuplicate(focusedPane(menu.entry).id)}>Duplicar</li>
          <li onClick={() => setEditing(menu.entry.id)}>Renombrar</li>
          {menu.entry.split && <li onClick={() => onSeparate(menu.entry.id)}>Separar pestaña</li>}
          <li className="sep" />
          <li onClick={() => onClose(menu.entry)}>Cerrar</li>
        </MenuList>
      )}
    </div>
  );
}
