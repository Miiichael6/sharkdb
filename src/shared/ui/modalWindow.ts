import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

/** Query parameter a modal window is loaded with (see `currentModalView`). */
const MODAL_VIEW_PARAM = "view";

// One modal window per view at a time (the opener is disabled meanwhile), so the view names its events.
const readyEvent = (view: string) => `modal-ready:${view}`;
const dataEvent = (view: string) => `modal-data:${view}`;
const resultEvent = (view: string) => `modal-result:${view}`;

interface Options {
  title: string;
  width: number;
  height: number;
  /** Lets the window be maximized; it can always be resized. */
  maximizable?: boolean;
}

/**
 * Opens `view` in its own OS window, owned by this one and centred over it, which stays disabled
 * until the child closes. The child gets `data` through `receiveModalData`; this resolves with
 * what it sent through `finishModalWindow`, or null when it was closed without an answer.
 */
export async function openModalWindow<T>(view: string, data: unknown, options: Options): Promise<T | null> {
  const { title, width, height, maximizable = false } = options;
  const parent = getCurrentWindow();
  const scale = await parent.scaleFactor();
  const pos = (await parent.outerPosition()).toLogical(scale);
  const size = (await parent.outerSize()).toLogical(scale);

  let result: T | null = null;
  const unlisten = await Promise.all([
    listen(readyEvent(view), () => void emit(dataEvent(view), data)),
    listen<T>(resultEvent(view), (e) => (result = e.payload)),
  ]);
  try {
    await parent.setEnabled(false);
    const child = new WebviewWindow(`modal-${view}`, {
      url: `index.html?${new URLSearchParams({ [MODAL_VIEW_PARAM]: view })}`,
      title,
      width,
      height,
      x: Math.round(pos.x + (size.width - width) / 2),
      y: Math.round(pos.y + (size.height - height) / 2),
      parent,
      minimizable: false,
      maximizable,
      skipTaskbar: true,
    });
    await new Promise<void>((resolve) => {
      void child.once("tauri://destroyed", () => resolve());
      void child.once("tauri://error", () => resolve());
    });
  } finally {
    unlisten.forEach((u) => u());
    await parent.setEnabled(true);
    await parent.setFocus();
  }
  return result;
}

/**
 * From inside a modal window: asks the opener for the data it passed to `openModalWindow` and hands
 * it to `onData`. Returns the cleanup; once called, the request is not sent or no longer listened to.
 */
export function receiveModalData<T>(view: string, onData: (data: T) => void): () => void {
  let stop: (() => void) | undefined;
  let cancelled = false;
  void listen<T>(dataEvent(view), (e) => onData(e.payload)).then((unlisten) => {
    if (cancelled) return unlisten();
    stop = unlisten;
    void emit(readyEvent(view));
  });
  return () => {
    cancelled = true;
    stop?.();
  };
}

/** From inside a modal window: hands `result` to the window that opened it and closes this one. */
export async function finishModalWindow(view: string, result: unknown) {
  if (result !== null) await emit(resultEvent(view), result);
  await getCurrentWindow().close();
}

/** The view this window shows when it was opened by `openModalWindow`. */
export function currentModalView(): string | null {
  return new URLSearchParams(window.location.search).get(MODAL_VIEW_PARAM);
}
