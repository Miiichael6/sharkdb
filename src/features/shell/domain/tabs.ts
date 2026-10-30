// Shell tabs, like Robo 3T's: each one is a script editor bound to a server and a database.
// Pure state transitions; the UI keeps a `TabsState` and swaps it for the returned one.

export interface ShellTab {
  id: string;
  /** Server session (saved-connection id) the scripts run on. */
  sid: string;
  serverLabel: string;
  db: string;
  /** Collection the tab was opened on, if any. */
  coll?: string;
  title: string;
  code: string;
  /** Script file the tab was opened from or saved to. */
  filePath: string | null;
  /** Code as it was last opened or saved, to tell whether there are unsaved changes. */
  savedCode: string;
  /** Run the code as soon as the tab shows up (a collection opened from the explorer). */
  runOnOpen: boolean;
}

export interface TabsState {
  tabs: ShellTab[];
  activeId: string | null;
}

export type NewTab = Pick<ShellTab, "sid" | "serverLabel" | "db"> &
  Partial<Pick<ShellTab, "coll" | "title" | "code" | "filePath" | "runOnOpen">>;

export const EMPTY_TABS: TabsState = { tabs: [], activeId: null };

/** Database a shell opened on a whole server starts in. */
export const DEFAULT_SHELL_DB = "test";

/** Query a tab opened on a collection starts with, as in Robo 3T. */
export const defaultQuery = (coll: string) => `db.getCollection('${coll.replace(/'/g, "\\'")}').find({})`;

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** Unsaved changes to the tab's script file (tabs without a file aren't tracked, as in Robo 3T). */
export const isDirty = (tab: ShellTab) => tab.filePath !== null && tab.code !== tab.savedCode;

export const activeTab = (state: TabsState) => state.tabs.find((t) => t.id === state.activeId);

/** Adds a tab right after the active one and makes it active. */
export function openTab(state: TabsState, id: string, init: NewTab): TabsState {
  const code = init.code ?? "";
  const tab: ShellTab = {
    id,
    sid: init.sid,
    serverLabel: init.serverLabel,
    db: init.db,
    coll: init.coll,
    title: init.title ?? init.coll ?? init.db,
    code,
    filePath: init.filePath ?? null,
    savedCode: init.filePath ? code : "",
    runOnOpen: init.runOnOpen ?? false,
  };
  const at = state.tabs.findIndex((t) => t.id === state.activeId) + 1 || state.tabs.length;
  return { tabs: [...state.tabs.slice(0, at), tab, ...state.tabs.slice(at)], activeId: id };
}

/** Removes a tab; if it was active, its right neighbour (or else the left one) becomes active. */
export function closeTab(state: TabsState, id: string): TabsState {
  const i = state.tabs.findIndex((t) => t.id === id);
  if (i < 0) return state;
  const tabs = state.tabs.filter((t) => t.id !== id);
  if (state.activeId !== id) return { tabs, activeId: state.activeId };
  return { tabs, activeId: (tabs[i] ?? tabs[i - 1])?.id ?? null };
}

/** Removes every tab of a server session (on disconnect). */
export function closeSessionTabs(state: TabsState, sid: string): TabsState {
  return state.tabs.filter((t) => t.sid === sid).reduce((s, t) => closeTab(s, t.id), state);
}

/** Copy of a tab (same server, database and code) that isn't tied to its file and doesn't run by itself. */
export function duplicateTab(state: TabsState, id: string, newId: string): TabsState {
  const source = state.tabs.find((t) => t.id === id);
  if (!source) return state;
  return openTab({ ...state, activeId: id }, newId, { ...source, filePath: null, runOnOpen: false });
}

/** Moves a tab to position `to` (clamped), keeping the active one. */
export function moveTab(state: TabsState, id: string, to: number): TabsState {
  const from = state.tabs.findIndex((t) => t.id === id);
  if (from < 0) return state;
  const tabs = state.tabs.filter((t) => t.id !== id);
  const at = Math.min(Math.max(to, 0), tabs.length);
  tabs.splice(at, 0, state.tabs[from]);
  return { ...state, tabs };
}

/** Slot of equal-width tabs that a dragged tab's centre is over (`left` is its offset in the strip). */
export function dropSlot(left: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0;
  return Math.min(Math.max(Math.floor((left + width / 2) / width), 0), count - 1);
}

export const activateTab = (state: TabsState, id: string): TabsState =>
  state.tabs.some((t) => t.id === id) ? { ...state, activeId: id } : state;

export function updateTab(state: TabsState, id: string, patch: Partial<Omit<ShellTab, "id">>): TabsState {
  return { ...state, tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
}

export const renameTab = (state: TabsState, id: string, title: string): TabsState =>
  title.trim() ? updateTab(state, id, { title: title.trim() }) : state;

/** The tab now holds `path`: it takes the file's name and has no unsaved changes. */
export function markSaved(state: TabsState, id: string, path: string, code: string): TabsState {
  return updateTab(state, id, { filePath: path, title: fileName(path), savedCode: code });
}
