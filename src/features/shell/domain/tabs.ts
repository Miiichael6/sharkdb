// Shell tabs, like Robo 3T's: each one is a script editor bound to a server and a database.
// Pure state transitions; the UI keeps a `TabsState` and swaps it for the returned one.
import { collectionScript } from "./menuScripts";

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
  /** Bumped to ask the tab, already shown, to run its script again (Ctrl+Enter on its collection). */
  runRequest: number;
}

export type Side = 0 | 1;

/** Two tabs shown side by side as one entry of the bar; `left` sits right before `right` in `tabs`. */
export interface Split {
  left: string;
  right: string;
  /** Pane that was last active, to come back to it. */
  activePane: Side;
  /** Share of the width the left pane takes. */
  ratio: number;
}

export interface TabsState {
  tabs: ShellTab[];
  splits: Split[];
  /** Active tab: on a split, its active pane. */
  activeId: string | null;
}

export type NewTab = Pick<ShellTab, "sid" | "serverLabel" | "db"> &
  Partial<Pick<ShellTab, "coll" | "title" | "code" | "filePath" | "runOnOpen">>;

export const EMPTY_TABS: TabsState = { tabs: [], splits: [], activeId: null };

/** Database a shell opened on a whole server starts in. */
export const DEFAULT_SHELL_DB = "test";

/** Query a tab opened on a collection starts with, as in Robo 3T. */
export const defaultQuery = (coll: string) => collectionScript("viewDocuments", coll).code;

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** Unsaved changes to the tab's script file (tabs without a file aren't tracked, as in Robo 3T). */
export const isDirty = (tab: ShellTab) => tab.filePath !== null && tab.code !== tab.savedCode;

export const activeTab = (state: TabsState) => state.tabs.find((t) => t.id === state.activeId);

export const splitOf = (state: TabsState, id: string) => state.splits.find((s) => s.left === id || s.right === id);

/** Tab ids grouped as the bar shows them: one per tab, two per split. */
export function tabGroups(state: TabsState): string[][] {
  const groups: string[][] = [];
  for (const { id } of state.tabs) {
    const split = splitOf(state, id);
    if (split?.right === id) continue;
    groups.push(split ? [split.left, split.right] : [id]);
  }
  return groups;
}

/** Tabs in the order of `groups` (from `tabGroups`). */
export const fromGroups = (state: TabsState, groups: string[][]): ShellTab[] =>
  groups.flat().map((id) => state.tabs.find((t) => t.id === id)!);

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
    runRequest: 0,
  };
  // After the active tab, or after both panes when it's a split.
  const split = state.activeId ? splitOf(state, state.activeId) : undefined;
  const after = split?.right ?? state.activeId;
  const at = state.tabs.findIndex((t) => t.id === after) + 1 || state.tabs.length;
  return { ...state, tabs: [...state.tabs.slice(0, at), tab, ...state.tabs.slice(at)], activeId: id };
}

/**
 * Removes a tab; if it was active, its right neighbour (or else the left one) becomes active. A pane
 * of a split leaves the other one as a plain tab, which takes over when the closed one was active.
 */
export function closeTab(state: TabsState, id: string): TabsState {
  const i = state.tabs.findIndex((t) => t.id === id);
  if (i < 0) return state;
  const tabs = state.tabs.filter((t) => t.id !== id);
  const split = splitOf(state, id);
  const splits = state.splits.filter((s) => s !== split);
  if (state.activeId !== id) return { tabs, splits, activeId: state.activeId };
  const partner = split && (split.left === id ? split.right : split.left);
  return { tabs, splits, activeId: partner ?? (tabs[i] ?? tabs[i - 1])?.id ?? null };
}

/**
 * Runs the script of the tab on `init`'s collection (the active one when it is, else the first),
 * activating it; with none, opens `init` as a new tab.
 */
export function runCollectionTab(state: TabsState, id: string, init: NewTab): TabsState {
  const onColl = (t: ShellTab) => t.sid === init.sid && t.db === init.db && t.coll === init.coll;
  const active = activeTab(state);
  const tab = active && onColl(active) ? active : state.tabs.find(onColl);
  if (!init.coll || !tab) return openTab(state, id, init);
  return updateTab(activateTab(state, tab.id), tab.id, { runRequest: tab.runRequest + 1 });
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

/** Moves a bar entry (a tab, or both panes of a split) to position `to` (clamped), keeping the active one. */
export function moveTab(state: TabsState, id: string, to: number): TabsState {
  const groups = tabGroups(state);
  const from = groups.findIndex((g) => g.includes(id));
  if (from < 0) return state;
  const [moved] = groups.splice(from, 1);
  groups.splice(Math.min(Math.max(to, 0), groups.length), 0, moved);
  return { ...state, tabs: fromGroups(state, groups) };
}

/** Slot of equal-width tabs that a dragged tab's centre is over (`left` is its offset in the strip). */
export function dropSlot(left: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0;
  return Math.min(Math.max(Math.floor((left + width / 2) / width), 0), count - 1);
}

/** Makes a tab (or a pane of a split, which the split then remembers) the active one. */
export function activateTab(state: TabsState, id: string): TabsState {
  if (!state.tabs.some((t) => t.id === id)) return state;
  const splits = state.splits.map((s) =>
    s.left === id || s.right === id ? { ...s, activePane: (s.left === id ? 0 : 1) as Side } : s,
  );
  return { ...state, splits, activeId: id };
}

export function updateTab(state: TabsState, id: string, patch: Partial<Omit<ShellTab, "id">>): TabsState {
  return { ...state, tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
}

export const renameTab = (state: TabsState, id: string, title: string): TabsState =>
  title.trim() ? updateTab(state, id, { title: title.trim() }) : state;

/** The tab now holds `path`: it takes the file's name and has no unsaved changes. */
export function markSaved(state: TabsState, id: string, path: string, code: string): TabsState {
  return updateTab(state, id, { filePath: path, title: fileName(path), savedCode: code });
}
