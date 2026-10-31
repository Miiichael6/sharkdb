import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

/** Whether this window is maximized, kept up to date as it is resized. */
function useMaximized(watch: boolean) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!watch) return;
    const win = getCurrentWindow();
    const refresh = () => void win.isMaximized().then(setMaximized);
    refresh();
    const unlisten = win.onResized(refresh);
    return () => void unlisten.then((stop) => stop());
  }, [watch]);
  return maximized;
}

/**
 * Title bar of a modal window, which has no OS one: the title centred, a maximize / restore button
 * when `maximizable` and a close button that turns red on hover (none when `closable` is false).
 * Dragging anywhere but the buttons moves the window.
 */
export function ModalTitleBar({ title, closable, maximizable = false }: { title: string; closable: boolean; maximizable?: boolean }) {
  const maximized = useMaximized(maximizable);
  const toggleMaximize = () => void getCurrentWindow().toggleMaximize();

  return (
    <header className="modal-titlebar" data-tauri-drag-region>
      <span className="modal-titlebar-title" data-tauri-drag-region>
        {title}
      </span>
      <div className="modal-titlebar-buttons">
        {maximizable && (
          <button
            type="button"
            className="modal-titlebar-maximize"
            title={maximized ? "Restaurar" : "Maximizar"}
            aria-label={maximized ? "Restaurar" : "Maximizar"}
            onClick={toggleMaximize}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden>
              {maximized ? (
                <>
                  <rect x="1.5" y="3.5" width="7" height="7" />
                  <path d="M3.5 3.5v-2h7v7h-2" />
                </>
              ) : (
                <rect x="1.5" y="1.5" width="9" height="9" />
              )}
            </svg>
          </button>
        )}
        {closable && (
          <button
            type="button"
            className="modal-titlebar-close"
            title="Cerrar"
            aria-label="Cerrar"
            onClick={() => void getCurrentWindow().close()}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
