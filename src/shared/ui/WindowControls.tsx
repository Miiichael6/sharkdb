import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Minimize, maximize and close for a window drawn without the OS title bar; the close turns red on
 * hover, as in Windows.
 */
export function WindowControls() {
  const win = getCurrentWindow();
  return (
    <div className="window-controls">
      <button type="button" className="window-control" title="Minimizar" aria-label="Minimizar" onClick={() => void win.minimize()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button type="button" className="window-control" title="Maximizar" aria-label="Maximizar" onClick={() => void win.toggleMaximize()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button type="button" className="window-control close" title="Cerrar" aria-label="Cerrar" onClick={() => void win.close()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  );
}
