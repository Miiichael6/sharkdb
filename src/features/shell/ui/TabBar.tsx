import { useEffect, useState } from "react";
import { isDirty, type ShellTab } from "../domain/tabs";

interface Props {
  tabs: ShellTab[];
  /** Active shell tab; null while "Detalles" is shown. */
  activeId: string | null;
  onShowDetails: () => void;
  onActivate: (id: string) => void;
  onClose: (tab: ShellTab) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

const MIDDLE_BUTTON = 1;

/** Tab strip: a pinned "Detalles" tab, then the shell tabs (double click renames, middle click closes). */
export function TabBar({ tabs, activeId, onShowDetails, onActivate, onClose, onDuplicate, onRename }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; tab: ShellTab } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

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

  const detailsActive = activeId === null;
  return (
    <div className="tab-bar" role="tablist" aria-label="Pestañas">
      <button role="tab" aria-selected={detailsActive} className={`tab ${detailsActive ? "active" : ""}`} onClick={onShowDetails}>
        Detalles
      </button>
      {tabs.map((t) => {
        const selected = t.id === activeId;
        return (
          <div
            key={t.id}
            role="tab"
            aria-selected={selected}
            className={`tab ${selected ? "active" : ""}`}
            title={t.filePath ?? `${t.serverLabel} · ${t.db}`}
            onClick={() => onActivate(t.id)}
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

      {menu && (
        <ul className="context-menu" style={{ left: menu.x, top: menu.y }}>
          <li onClick={() => onDuplicate(menu.tab.id)}>Duplicar</li>
          <li onClick={() => setEditing(menu.tab.id)}>Renombrar</li>
          <li className="sep" />
          <li onClick={() => onClose(menu.tab)}>Cerrar</li>
        </ul>
      )}
    </div>
  );
}
