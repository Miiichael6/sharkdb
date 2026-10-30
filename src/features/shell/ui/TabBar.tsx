import { useEffect, useRef, useState } from "react";
import { MenuList } from "../../../shared/ui/MenuList";
import { isDirty, type ShellTab } from "../domain/tabs";
import { useActivePill } from "./useActivePill";
import { useTabDrag } from "./useTabDrag";

interface Props {
  tabs: ShellTab[];
  /** Active shell tab; null while the detail panel is shown. */
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (tab: ShellTab) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onMove: (id: string, to: number) => void;
}

const MIDDLE_BUTTON = 1;

/**
 * Shell tabs as a segmented control: equal-width tabs on a rounded track, the active one raised by a
 * highlight that slides between them. Drag reorders, double click renames, middle click closes.
 */
export function TabBar({ tabs, activeId, onActivate, onClose, onDuplicate, onRename, onMove }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; tab: ShellTab } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const ids = tabs.map((t) => t.id);
  const drag = useTabDrag({ track, ids, onMove });
  const { pill, ready } = useActivePill(track, activeId, ids.join());

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const finishRename = (id: string, title: string) => {
    onRename(id, title);
    setEditing(null);
  };

  if (!tabs.length) return null;
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
        {tabs.map((t) => {
          const selected = t.id === activeId;
          return (
            <div
              key={t.id}
              role="tab"
              aria-selected={selected}
              data-tab-id={t.id}
              className={`tab ${selected ? "active" : ""} ${drag.draggingId === t.id ? "dragging" : ""}`}
              title={t.filePath ?? `${t.serverLabel} · ${t.db}`}
              onPointerDown={drag.onPointerDown(t.id)}
              onClick={() => drag.consumeClick() || onActivate(t.id)}
              onDoubleClick={() => setEditing(t.id)}
              onMouseDown={(e) => e.button === MIDDLE_BUTTON && (e.preventDefault(), onClose(t))}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, tab: t });
              }}
            >
              {editing === t.id ? (
                <input
                  className="tab-rename"
                  defaultValue={t.title}
                  autoFocus
                  onBlur={(e) => finishRename(t.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishRename(t.id, e.currentTarget.value);
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <span className="tab-title">
                  {t.title}
                  {isDirty(t) && <span aria-label="sin guardar"> •</span>}
                </span>
              )}
              <button
                className="tab-close"
                aria-label={`Cerrar ${t.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(t);
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
          <li onClick={() => onDuplicate(menu.tab.id)}>Duplicar</li>
          <li onClick={() => setEditing(menu.tab.id)}>Renombrar</li>
          <li className="sep" />
          <li onClick={() => onClose(menu.tab)}>Cerrar</li>
        </MenuList>
      )}
    </div>
  );
}
