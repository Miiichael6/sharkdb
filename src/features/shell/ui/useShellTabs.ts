import { useCallback, useState } from "react";
import { useServices } from "../../../app/services";
import type { TreeNode } from "../../explorer/domain/tree";
import {
  activateTab,
  closeSessionTabs,
  closeTab,
  DEFAULT_SHELL_DB,
  defaultQuery,
  duplicateTab,
  EMPTY_TABS,
  markSaved,
  moveTab,
  openTab,
  renameTab,
  updateTab,
  type NewTab,
  type ShellTab,
} from "../domain/tabs";

export type ShellTabs = ReturnType<typeof useShellTabs>;

/**
 * New tab for a tree node: on its database (or the default one). On a collection it starts with the
 * default query and, when `run`, runs it right away (opening a collection from the explorer).
 */
export function tabForNode(node: TreeNode, serverLabel: string, run = false): NewTab {
  const db = node.db ?? DEFAULT_SHELL_DB;
  if (node.kind === "collection" && node.coll) {
    return { sid: node.sid, serverLabel, db, coll: node.coll, code: defaultQuery(node.coll), runOnOpen: run };
  }
  return { sid: node.sid, serverLabel, db };
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

  const close = useCallback(
    (tab: ShellTab) => {
      setState((s) => closeTab(s, tab.id));
      shell.close({ sid: tab.sid, tab: tab.id }).catch(() => {});
    },
    [shell],
  );

  const activate = useCallback((id: string) => {
    setState((s) => activateTab(s, id));
    setDetailsShown(false);
  }, []);

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

  const active = detailsShown ? undefined : state.tabs.find((t) => t.id === state.activeId);

  return {
    tabs: state.tabs,
    active,
    open,
    close,
    activate,
    showDetails,
    closeSession,
    duplicate,
    move,
    rename,
    setCode,
    saved,
  };
}
