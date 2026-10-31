import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Title bar of a modal window, which has no OS one: the title centred and a close button that
 * turns red on hover. Dragging anywhere but the button moves the window.
 */
export function ModalTitleBar({ title }: { title: string }) {
  return (
    <header className="modal-titlebar" data-tauri-drag-region>
      <span className="modal-titlebar-title" data-tauri-drag-region>
        {title}
      </span>
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
    </header>
  );
}
