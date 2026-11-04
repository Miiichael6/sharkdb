import { useEffect, useRef } from "react";

/** The open menus: the only things that may scroll while one is open. */
const MENU_SELECTOR = ".context-menu";

interface ScrollBox {
  scrollHeight: number;
  clientHeight: number;
}

interface MaybeElement {
  closest?: (selector: string) => ScrollBox | null;
}

/** The menu `target` is in, when that menu is taller than the window and scrolls. */
export const scrollingMenu = (target: EventTarget | null): ScrollBox | null => {
  const menu = (target as MaybeElement | null)?.closest?.(MENU_SELECTOR) ?? null;
  return menu && menu.scrollHeight > menu.clientHeight ? menu : null;
};

/** Whether `target` is inside an open menu. */
const inMenu = (target: EventTarget | null) => !!(target as MaybeElement | null)?.closest?.(MENU_SELECTOR);

/**
 * Keeps the window still under an open menu, which stays where it opened: the wheel and touch
 * scroll only a menu that scrolls itself, and anything else that scrolls (dragging a scroll bar)
 * closes the menu. Returns what releases the lock.
 */
export function lockScroll(win: EventTarget, onClose: () => void): () => void {
  const block = (e: Event) => !scrollingMenu(e.target) && e.preventDefault();
  const onScroll = (e: Event) => !inMenu(e.target) && onClose();
  // Not passive: a passive listener can't cancel the scroll.
  const options = { capture: true, passive: false };
  win.addEventListener("wheel", block, options);
  win.addEventListener("touchmove", block, options);
  win.addEventListener("scroll", onScroll, options);
  return () => {
    win.removeEventListener("wheel", block, options);
    win.removeEventListener("touchmove", block, options);
    win.removeEventListener("scroll", onScroll, options);
  };
}

/** `lockScroll` on the window while the menu is open. `enabled` false for a submenu: its menu holds the lock. */
export function useScrollLock(onClose: () => void, enabled = true) {
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    return lockScroll(window, () => latest.current());
  }, [enabled]);
}
