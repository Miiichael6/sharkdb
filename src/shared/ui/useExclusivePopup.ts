import { useEffect, useRef } from "react";

/** Closes the menu or popup open now: only one is open at a time across the window. */
let closeOpen: (() => void) | null = null;

/** What a right-click inside does not close: the open menus and popups themselves. */
const POPUP_SELECTOR = ".context-menu, .notification-center";

/**
 * Makes a menu or popup the only one open: mounting it closes the one open before (another
 * component's, which a click stopped on its way to the window would leave open), and a right-click
 * outside closes it like a click. `enabled` false for a submenu, which lives inside its menu.
 */
export function useExclusivePopup(onClose: () => void, enabled = true) {
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const close = () => latest.current();
    closeOpen?.();
    closeOpen = close;
    // Capture: closes before the right-click's own handler, which may open this same menu again elsewhere.
    const onContextMenu = (e: MouseEvent) => !(e.target as Element | null)?.closest?.(POPUP_SELECTOR) && close();
    window.addEventListener("contextmenu", onContextMenu, true);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu, true);
      if (closeOpen === close) closeOpen = null;
    };
  }, [enabled]);
}
