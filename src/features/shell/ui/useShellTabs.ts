import { useCallback, useState } from "react";
import { useServices } from "../../../app/services";
import type { NodeKind, TreeNode } from "../../explorer/domain/tree";
import {
  activateTab,
  closeSessionTabs,
  closeTab,
  DEFAULT_SHELL_DB,
  duplicateTab,
  EMPTY_TABS,
  markSaved,
  moveTab,
  openTab,
  renameTab,
  runCollectionTab,
  updateTab,
  splitOf,
  type NewTab,
  type ShellTab,
  type Side,
} from "../domain/tabs";
import { activateEntry, activeEntryId, barEntries, openBeside, separateTab, setSplitRatio, splitWithTab } from "../domain/splitTabs";
import { menuScript, type MenuScriptKind } from "../domain/menuScripts";

export type ShellTabs = ReturnType<typeof useShellTabs>;

/** Nodes whose shell tab works on their collection. */
const COLLECTION_NODES: NodeKind[] = ["collection", "indexes"];

/**
 * New tab for a tree node: on its database (or the default one). It starts with `script` (the
 * default query unless told otherwise) when the node has what it needs (a collection, or nothing for
 * a server script) and, when `run` and the script allows it, runs it right away.
 */
export function tabForNode(node: TreeNode, serverLabel: string, run = false, script: MenuScriptKind = "viewDocuments"): NewTab {
  const db = node.db ?? DEFAULT_SHELL_DB;
  const coll = COLLECTION_NODES.includes(node.kind) ? node.coll : undefined;
  const found = menuScript(script, coll);
  if (!found) return { sid: node.sid, serverLabel, db };
  return { sid: node.sid, serverLabel, db, coll, code: found.code, runOnOpen: run && found.run };
}

/**
 * Open shell tabs plus the explorer's detail panel, which is shown (without a tab of its own)
 * while `detailsShown` or when there are no shell tabs.
 */
export function useShellTabs() {
  const { shell } = useServices();
  const [state, setState] = useState(EMPTY_TABS);
  const [detailsShown, setDetailsShown] = useState(true);

  const open = useCallback((init: NewTab) => {
    setState((s) => openTab(s, crypto.randomUUID(), init));
    setDetailsShown(false);
  }, []);

  /** Runs the tab already on `init`'s collection, or opens `init` when there's none. */
  const runCollection = useCallback((init: NewTab) => {
    setState((s) => runCollectionTab(s, crypto.randomUUID(), init));
    setDetailsShown(false);
  }, []);

  /** Opens a tab on `side` of the shown one (which becomes a split). */
  const openAside = useCallback((init: NewTab, side: Side) => {
    setState((s) => openBeside(s, crypto.randomUUID(), init, side));
    setDetailsShown(false);
  }, []);

  const close = useCallback(
    (tab: ShellTab) => {
      setState((s) => closeTab(s, tab.id));
      shell.close({ sid: tab.sid, tab: tab.id }).catch(() => {});
    },
    [shell],
  );

  /** Activates a bar entry (a split comes back to its last active pane). */
  const activate = useCallback((id: string) => {
    setState((s) => activateEntry(s, id));
    setDetailsShown(false);
  }, []);

  /** Makes a pane of the shown split the active one. */
  const focus = useCallback((id: string) => setState((s) => activateTab(s, id)), []);

  const split = useCallback((draggedId: string, side: Side) => setState((s) => splitWithTab(s, draggedId, side)), []);
  const separate = useCallback((id: string) => setState((s) => separateTab(s, id)), []);
  const setRatio = useCallback((id: string, ratio: number) => setState((s) => setSplitRatio(s, id, ratio)), []);

  const showDetails = useCallback(() => setDetailsShown(true), []);

  // The server already dropped the session's shells when it disconnected.
  const closeSession = useCallback((sid: string) => setState((s) => closeSessionTabs(s, sid)), []);

  const duplicate = useCallback((id: string) => setState((s) => duplicateTab(s, id, crypto.randomUUID())), []);
  const move = useCallback((id: string, to: number) => setState((s) => moveTab(s, id, to)), []);
  const rename = useCallback((id: string, title: string) => setState((s) => renameTab(s, id, title)), []);
  const setCode = useCallback((id: string, code: string) => setState((s) => updateTab(s, id, { code })), []);
  const saved = useCallback(
    (id: string, path: string, code: string) => setState((s) => markSaved(s, id, path, code)),
    [],
  );

  // The active tab is the active pane of a split, so shortcuts and toolbar actions work on it.
  const active = detailsShown ? undefined : state.tabs.find((t) => t.id === state.activeId);

  return {
    tabs: state.tabs,
    entries: barEntries(state),
    /** Bar entry being shown; null while the detail panel is. */
    activeEntryId: detailsShown ? null : activeEntryId(state),
    /** Split being shown, if any. */
    activeSplit: active && splitOf(state, active.id),
    active,
    open,
    runCollection,
    openAside,
    close,
    activate,
    focus,
    split,
    separate,
    setRatio,
    showDetails,
    closeSession,
    duplicate,
    move,
    rename,
    setCode,
    saved,
  };
}
