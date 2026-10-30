import { useEffect, useMemo, useRef, useState } from "react";
import { displayName, hostLabel, type MongoConnection } from "../domain/connection";
import { Avatar, ConfirmDialog, Logo, Spinner } from "../../../shared/ui/common";
import { MenuList } from "../../../shared/ui/MenuList";
import { TagBadge } from "./TagBadge";

interface Props {
  connections: MongoConnection[];
  openIds: string[];
  connectingId: string | null;
  error: string;
  onNew: () => void;
  onConnect: (c: MongoConnection) => void;
  onEdit: (c: MongoConnection) => void;
  onDuplicate: (c: MongoConnection) => void;
  onDelete: (c: MongoConnection) => void;
  onDismissError: () => void;
  /** Present while some connection is open: returns to the explorer. */
  onBack?: () => void;
}

interface MenuState {
  x: number;
  y: number;
  conn: MongoConnection;
}

export function Welcome(props: Props) {
  const { connections, openIds, connectingId, error, onNew, onConnect, onEdit, onDuplicate, onDelete } = props;
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [toDelete, setToDelete] = useState<MongoConnection | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((c) =>
      [displayName(c), hostLabel(c), c.tag].some((s) => s.toLowerCase().includes(q)),
    );
  }, [connections, query]);

  const selected = visible.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector(".backdrop")) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (ctrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNew();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!visible.length) return;
        const i = visible.findIndex((c) => c.id === selectedId);
        const next = e.key === "ArrowDown" ? Math.min(i + 1, visible.length - 1) : Math.max(i - 1, 0);
        setSelectedId(visible[next].id);
      } else if (e.key === "Enter" && selected) {
        onConnect(selected);
      } else if (e.key === "Delete" && selected && document.activeElement !== searchRef.current) {
        setToDelete(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selected, selectedId, onNew, onConnect]);

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

  return (
    <div className="welcome">
      <aside className="welcome-side">
        <Logo size={116} />
        <h1>Robo3B</h1>
        <span className="muted">Versión 0.1.0</span>
        <p className="side-hint">Cliente de escritorio para MongoDB</p>
      </aside>

      <section className="welcome-main">
        <div className="toolbar">
          <button className="icon-btn" onClick={onNew} title="Nueva conexión (Ctrl+N)" aria-label="Nueva conexión">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <input
            ref={searchRef}
            className="search"
            placeholder="Buscar conexión... (Ctrl F)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          />
          <span className="spacer" />
          {props.onBack && (
            <button onClick={props.onBack}>
              Volver al explorador ({openIds.length})
            </button>
          )}
        </div>

        <ul className="conn-list" onClick={() => setSelectedId(null)}>
          {visible.map((c) => (
            <li
              key={c.id}
              className={`conn-item ${c.id === selectedId ? "selected" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(c.id);
              }}
              onDoubleClick={() => onConnect(c)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSelectedId(c.id);
                setMenu({ x: e.clientX, y: e.clientY, conn: c });
              }}
            >
              <Avatar color={c.color} />
              <div className="conn-text">
                <div className="conn-title">
                  <span className="conn-name">{displayName(c)}</span>
                  <TagBadge tag={c.tag} />
                  {openIds.includes(c.id) && <span className="online" title="Conectada" />}
                </div>
                <span className="conn-host">{hostLabel(c)}</span>
              </div>
              {connectingId === c.id && <Spinner />}
            </li>
          ))}
        </ul>

        {connections.length === 0 && (
          <div className="empty">
            <p>Todavía no hay conexiones.</p>
            <button className="primary" onClick={onNew}>
              Crear conexión
            </button>
          </div>
        )}
        {connections.length > 0 && visible.length === 0 && (
          <div className="empty">
            <p>Ninguna conexión coincide con “{query}”.</p>
          </div>
        )}

        {error && (
          <div className="error-bar" role="alert">
            <span>{error}</span>
            <button className="ghost" onClick={props.onDismissError} aria-label="Cerrar">
              ✕
            </button>
          </div>
        )}
      </section>

      {menu && (
        <MenuList x={menu.x} y={menu.y}>
          <li onClick={() => onConnect(menu.conn)}>Conectar</li>
          <li onClick={() => onEdit(menu.conn)}>Editar</li>
          <li onClick={() => onDuplicate(menu.conn)}>Duplicar</li>
          <li className="sep" />
          <li className="danger" onClick={() => setToDelete(menu.conn)}>
            Eliminar
          </li>
        </MenuList>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Eliminar conexión"
          message={`¿Eliminar “${displayName(toDelete)}”? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            onDelete(toDelete);
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}
