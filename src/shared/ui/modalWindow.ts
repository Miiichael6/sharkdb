import { emit, listen } from "@tauri-apps/api/event";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { errorMessage } from "../errors";

/** Query parameter a modal window is loaded with (see `currentModalView`). */
const MODAL_VIEW_PARAM = "view";
/** Query parameter with the title the modal draws in its own title bar (see `currentModalTitle`). */
const MODAL_TITLE_PARAM = "title";
/** Query parameter set when the modal's title bar has no close button (see `currentModalClosable`). */
const MODAL_UNCLOSABLE_PARAM = "unclosable";
/** Query parameter set when the modal's title bar has a maximize button (see `currentModalMaximizable`). */
const MODAL_MAXIMIZABLE_PARAM = "maximizable";
/** Query parameter with the label of the window that opened the modal (see `releaseOpener`). */
const MODAL_OPENER_PARAM = "opener";
/** Query parameter set when the modal takes the height of its content (see `currentModalFitsContent`). */
const MODAL_FIT_PARAM = "fit";

// One modal window per view at a time (the opener is disabled meanwhile), so the view names its events.
const readyEvent = (view: string) => `modal-ready:${view}`;
const dataEvent = (view: string) => `modal-data:${view}`;
const resultEvent = (view: string) => `modal-result:${view}`;
const requestEvent = (view: string) => `modal-request:${view}`;
const responseEvent = (view: string) => `modal-response:${view}`;

interface OpenerRequest {
  id: string;
  body: unknown;
}

type OpenerResponse = { id: string; ok: true; value: unknown } | { id: string; ok: false; error: string };

interface Options {
  title: string;
  width: number;
  height: number;
  /** The least height it can be resized to (logical px). */
  minHeight?: number;
  /** Lets the window be maximized, with a maximize / restore button in its title bar. */
  maximizable?: boolean;
  /** Lets the window be resized (default). */
  resizable?: boolean;
  /** Shows the close button of its title bar (default); without it, only the view's own buttons close it. */
  closable?: boolean;
  /**
   * Takes the height of its content once drawn, and follows it (e.g. an error line that appears), so
   * no empty space is left under the buttons; `height` is only the first guess. For short fixed forms.
   */
  fitContent?: boolean;
  /** Answers what the child asks with `askOpener` while it's open (e.g. connecting a connection). */
  onRequest?: (body: unknown) => Promise<unknown>;
  /**
   * Keeps the child's data live: called once with `send`, which hands the child newer data through
   * the same `receiveModalData`; returns what stops it, called when the child closes.
   */
  updates?: (send: (data: unknown) => void) => () => void;
}

/**
 * Opens `view` in its own OS window, owned by this one and centred over it, which stays disabled
 * until the child closes. The child gets `data` through `receiveModalData`; this resolves with
 * what it sent through `finishModalWindow`, or null when it was closed without an answer.
 */
export async function openModalWindow<T>(view: string, data: unknown, options: Options): Promise<T | null> {
  const { title, width, height, minHeight, maximizable = false, resizable = true, closable = true, fitContent = false, onRequest, updates } =
    options;
  const parent = getCurrentWindow();
  const scale = await parent.scaleFactor();
  const pos = (await parent.outerPosition()).toLogical(scale);
  const size = (await parent.outerSize()).toLogical(scale);

  let result: T | null = null;
  // The newest data: a child that gets ready late still starts from it.
  let latest = data;
  const unlisten = await Promise.all([
    listen(readyEvent(view), () => void emit(dataEvent(view), latest)),
    listen<T>(resultEvent(view), (e) => (result = e.payload)),
    listen<OpenerRequest>(requestEvent(view), ({ payload: { id, body } }) => {
      const answer = onRequest ? onRequest(body) : Promise.reject(new Error(`${view} no admite peticiones`));
      void answer.then(
        (value) => emit(responseEvent(view), { id, ok: true, value } satisfies OpenerResponse),
        // Only plain data crosses windows, so an Error travels as its message.
        (error) => emit(responseEvent(view), { id, ok: false, error: errorMessage(error) } satisfies OpenerResponse),
      );
    }),
  ]);
  const stopUpdates = updates?.((next) => {
    latest = next;
    void emit(dataEvent(view), next);
  });
  try {
    await parent.setEnabled(false);
    const child = new WebviewWindow(`modal-${view}`, {
      url: `index.html?${modalQuery(view, title, parent.label, closable, maximizable, fitContent)}`,
      title,
      width,
      height,
      ...(minHeight ? { minHeight } : {}),
      x: Math.round(pos.x + (size.width - width) / 2),
      y: Math.round(pos.y + (size.height - height) / 2),
      parent,
      minimizable: false,
      maximizable,
      resizable,
      skipTaskbar: true,
      // The modal draws its own title bar (ModalTitleBar), without the OS one.
      decorations: false,
      // Hidden, and in the theme's background, until its view is drawn (`showModalWindow`): no white flash.
      visible: false,
      backgroundColor: themeBackground(),
    });
    await new Promise<void>((resolve) => {
      void child.once("tauri://destroyed", () => resolve());
      void child.once("tauri://error", () => resolve());
    });
  } finally {
    stopUpdates?.();
    unlisten.forEach((u) => u());
    await parent.setEnabled(true);
    await parent.setFocus();
  }
  return result;
}

/** The page background of the current theme, so the new window is never white underneath. */
const themeBackground = () => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || undefined;

function modalQuery(
  view: string,
  title: string,
  opener: string,
  closable: boolean,
  maximizable: boolean,
  fitContent: boolean,
): URLSearchParams {
  const query = new URLSearchParams({ [MODAL_VIEW_PARAM]: view, [MODAL_TITLE_PARAM]: title, [MODAL_OPENER_PARAM]: opener });
  if (!closable) query.set(MODAL_UNCLOSABLE_PARAM, "1");
  if (maximizable) query.set(MODAL_MAXIMIZABLE_PARAM, "1");
  if (fitContent) query.set(MODAL_FIT_PARAM, "1");
  return query;
}

/** Whether this modal window takes the height of its content. */
export function currentModalFitsContent(): boolean {
  return new URLSearchParams(window.location.search).has(MODAL_FIT_PARAM);
}

/** From inside a modal window: sets its height (logical px), keeping its width. */
export async function setModalHeight(height: number) {
  await getCurrentWindow().setSize(new LogicalSize(window.innerWidth, Math.ceil(height)));
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

/**
 * From inside a modal window: asks the window that opened it to do something (its `onRequest`) and
 * resolves with its answer, or rejects with its error.
 */
export async function askOpener<T>(view: string, body: unknown): Promise<T> {
  const id = crypto.randomUUID();
  let unlisten: () => void = () => {};
  const response = new Promise<OpenerResponse>((resolve) => {
    void listen<OpenerResponse>(responseEvent(view), (e) => e.payload.id === id && resolve(e.payload)).then((stop) => {
      unlisten = stop;
      void emit(requestEvent(view), { id, body } satisfies OpenerRequest);
    });
  });
  const answer = await response.finally(() => unlisten());
  if (!answer.ok) throw answer.error;
  return answer.value as T;
}

/** From inside a modal window: shows it, once its view is drawn (it opens hidden). */
export async function showModalWindow() {
  const win = getCurrentWindow();
  await win.show();
  await win.setFocus();
}

/** From inside a modal window: hands `result` to the window that opened it and closes this one. */
export async function finishModalWindow(view: string, result: unknown) {
  if (result !== null) await emit(resultEvent(view), result);
  await releaseOpener();
  const win = getCurrentWindow();
  // Hidden first, so it doesn't flash blank while the OS tears it down.
  await win.hide();
  await win.close();
}

/**
 * From inside a modal window, right before it goes away: re-enables the window that opened it.
 * Windows hands the activation of a closing owned window to its owner only if the owner is enabled;
 * while it's still disabled, another app gets it and the opener flickers when it takes it back.
 */
export async function releaseOpener() {
  const label = new URLSearchParams(window.location.search).get(MODAL_OPENER_PARAM);
  const opener = label ? await Window.getByLabel(label) : null;
  await opener?.setEnabled(true);
}

/** The view this window shows when it was opened by `openModalWindow`. */
export function currentModalView(): string | null {
  return new URLSearchParams(window.location.search).get(MODAL_VIEW_PARAM);
}

/** The title this modal window was opened with. */
export function currentModalTitle(): string {
  return new URLSearchParams(window.location.search).get(MODAL_TITLE_PARAM) ?? "";
}

/** Whether this modal window's title bar has its close button. */
export function currentModalClosable(): boolean {
  return !new URLSearchParams(window.location.search).has(MODAL_UNCLOSABLE_PARAM);
}

/** Whether this modal window's title bar has its maximize / restore button. */
export function currentModalMaximizable(): boolean {
  return new URLSearchParams(window.location.search).has(MODAL_MAXIMIZABLE_PARAM);
}
