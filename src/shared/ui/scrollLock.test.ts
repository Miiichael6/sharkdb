import { describe, expect, it, vi } from "vitest";
import { lockScroll, scrollingMenu } from "./scrollLock";

/** An event target that answers `closest` like an element inside (or outside) a menu. */
class FakeTarget extends EventTarget {
  constructor(private menu: { scrollHeight: number; clientHeight: number } | null = null) {
    super();
  }
  closest(selector: string) {
    return selector === ".context-menu" ? this.menu : null;
  }
}

const SHORT_MENU = { scrollHeight: 100, clientHeight: 100 };
const TALL_MENU = { scrollHeight: 900, clientHeight: 600 };

/** Dispatches a cancelable `type` on `target` and says whether something canceled it. */
const canceled = (target: EventTarget, type: string) => !target.dispatchEvent(new Event(type, { cancelable: true }));

describe("scrollLock", () => {
  it("blocks the wheel and touch scrolling outside the menu", () => {
    const page = new FakeTarget();
    const release = lockScroll(page, vi.fn());
    expect(canceled(page, "wheel")).toBe(true);
    expect(canceled(page, "touchmove")).toBe(true);
    release();
  });

  it("blocks the wheel over a menu that doesn't scroll", () => {
    const menu = new FakeTarget(SHORT_MENU);
    const release = lockScroll(menu, vi.fn());
    expect(canceled(menu, "wheel")).toBe(true);
    release();
  });

  it("lets a menu taller than the window scroll itself", () => {
    const menu = new FakeTarget(TALL_MENU);
    const release = lockScroll(menu, vi.fn());
    expect(canceled(menu, "wheel")).toBe(false);
    expect(canceled(menu, "touchmove")).toBe(false);
    release();
  });

  it("closes the menu when something else scrolls (a dragged scroll bar)", () => {
    const page = new FakeTarget();
    const onClose = vi.fn();
    const release = lockScroll(page, onClose);
    page.dispatchEvent(new Event("scroll"));
    expect(onClose).toHaveBeenCalledOnce();
    release();
  });

  it("keeps the menu open while the menu itself scrolls", () => {
    const menu = new FakeTarget(TALL_MENU);
    const onClose = vi.fn();
    const release = lockScroll(menu, onClose);
    menu.dispatchEvent(new Event("scroll"));
    expect(onClose).not.toHaveBeenCalled();
    release();
  });

  it("lets the window scroll again once released", () => {
    const page = new FakeTarget();
    const onClose = vi.fn();
    lockScroll(page, onClose)();
    expect(canceled(page, "wheel")).toBe(false);
    page.dispatchEvent(new Event("scroll"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("finds only a menu that overflows", () => {
    expect(scrollingMenu(new FakeTarget(TALL_MENU))).toBe(TALL_MENU);
    expect(scrollingMenu(new FakeTarget(SHORT_MENU))).toBeNull();
    expect(scrollingMenu(new FakeTarget())).toBeNull();
    expect(scrollingMenu(null)).toBeNull();
  });
});
