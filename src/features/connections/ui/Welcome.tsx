import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { destructiveRequest } from "../../../shared/domain/destructiveActions";
import { displayName, hostLabel, targetServerOf, type MongoConnection } from "../domain/connection";
import { Avatar, Logo, Spinner } from "../../../shared/ui/common";
import { confirmDeleteInWindow } from "../../../shared/ui/confirmInWindow";
import { ContextMenu } from "../../../shared/ui/ContextMenu";
import { MenuList } from "../../../shared/ui/MenuList";
import { GearIcon, SETTINGS_ITEMS } from "../../../shared/ui/settingsMenu";
import { WindowControls } from "../../../shared/ui/WindowControls";
import { UpdateNotice } from "../../updates/ui/UpdateNotice";
import { ScreenSwitch, type Screen } from "./ScreenSwitch";
import { TagBadge } from "./TagBadge";

/** The "Backups" screen, owned by the backup feature: its panes for a search, and what "+" creates. */
export interface BackupsScreen {
  onNew: () => void;
  render: (query: string) => { side: ReactNode; main: ReactNode };
}


interface Props {
  backups: BackupsScreen;
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
  const [screen, setScreen] = useState<Screen>("connections");
  const [query, setQuery] = useState("");
  const onBackups = screen === "backups";
  const showScreen = (next: Screen) => {
    setScreen(next);
    setQuery("");
  };
  const createNew = onBackups ? props.backups.onNew : onNew;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [settingsAt, setSettingsAt] = useState<{ x: number; y: number } | null>(null);
  const confirmDelete = async (conn: MongoConnection) => {
    const request = destructiveRequest("deleteConnection", { server: targetServerOf(conn) });
    if (await confirmDeleteInWindow(request)) onDelete(conn);
  };
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((c) => [displayName(c), hostLabel(c), c.tag].some((s) => s.toLowerCase().includes(q)));
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
        createNew();
      } else if (onBackups) {
        return;
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!visible.length) return;
        const i = visible.findIndex((c) => c.id === selectedId);
        const next = e.key === "ArrowDown" ? Math.min(i + 1, visible.length - 1) : Math.max(i - 1, 0);
        setSelectedId(visible[next].id);
      } else if (e.key === "Enter" && selected) {
        onConnect(selected);
      } else if (e.key === "Delete" && selected && document.activeElement !== searchRef.current) {
        void confirmDelete(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selected, selectedId, createNew, onBackups, onConnect, onDelete]);

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

  const backups = onBackups ? props.backups.render(query) : null;
  return (
    <div className="welcome">
      {/* One aside for both screens: the switch stays mounted, so its highlight slides between them. */}
      <aside className={backups ? "welcome-side schedule-side" : "welcome-side"} data-tauri-drag-region={backups ? undefined : ""}>
        <ScreenSwitch screen={screen} onChange={showScreen} />
        {backups ? (
          backups.side
        ) : (
          <>
            <Logo size={190} swimming />
            <h1>SharkDB</h1>
            <span className="muted">Versión {__APP_VERSION__}</span>
            <UpdateNotice />
            <p className="side-hint">Cliente de escritorio para MongoDB</p>
          </>
        )}
      </aside>

      <section className="welcome-main">
        {/* Also the window's title bar (the window has no OS one here): drag it from its empty space. */}
        <div className="toolbar welcome-titlebar" data-tauri-drag-region>
          <button
            className="icon-btn"
            title="Ajustes"
            aria-label="Ajustes"
            aria-haspopup="menu"
            onClick={(e) => {
              // The menu closes on any window click; this one must not reach the window and close it again.
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setSettingsAt((at) => (at ? null : { x: rect.left, y: rect.bottom + 4 }));
            }}
          >
            <GearIcon />
          </button>
          <button
            className="icon-btn"
            onClick={createNew}
            title={onBackups ? "Nuevo backup programado (Ctrl+N)" : "Nueva conexión (Ctrl+N)"}
            aria-label={onBackups ? "Nuevo backup programado" : "Nueva conexión"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <input
            ref={searchRef}
            className="search"
            placeholder={onBackups ? "Buscar backup... (Ctrl F)" : "Buscar conexión... (Ctrl F)"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          />
          <span className="spacer" data-tauri-drag-region />
          {props.onBack && <button onClick={props.onBack}>Volver al explorador ({openIds.length})</button>}
          <WindowControls />
        </div>

        {backups ? (
          backups.main
        ) : (
          <>
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
          </>
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
        <MenuList x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          <li onClick={() => onConnect(menu.conn)}>Conectar</li>
          <li onClick={() => onEdit(menu.conn)}>Editar</li>
          <li onClick={() => onDuplicate(menu.conn)}>Duplicar</li>
          <li className="sep" />
          <li className="danger" onClick={() => void confirmDelete(menu.conn)}>
            Eliminar
          </li>
        </MenuList>
      )}
      {settingsAt && (
        <ContextMenu
          x={settingsAt.x}
          y={settingsAt.y}
          items={SETTINGS_ITEMS}
          onClose={() => setSettingsAt(null)}
          label="Ajustes"
        />
      )}
    </div>
  );
}
