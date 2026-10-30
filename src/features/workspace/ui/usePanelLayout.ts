import { useCallback, useEffect, useState } from "react";

const SIDEBAR_HIDDEN_KEY = "robo3b.sidebarHidden";

function readSidebarHidden(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_HIDDEN_KEY) === "true";
  } catch {
    return false;
  }
}

/** Which workspace panels are shown: the explorer (remembered across restarts) and the logs. */
export function usePanelLayout() {
  const [sidebarHidden, setSidebarHidden] = useState(readSidebarHidden);
  const [logsOpen, setLogsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_HIDDEN_KEY, String(sidebarHidden));
    } catch {
      // Without storage the choice just lasts until the app closes.
    }
  }, [sidebarHidden]);

  return {
    sidebarHidden,
    toggleSidebar: useCallback(() => setSidebarHidden((h) => !h), []),
    showSidebar: useCallback(() => setSidebarHidden(false), []),
    logsOpen,
    toggleLogs: useCallback(() => setLogsOpen((o) => !o), []),
    closeLogs: useCallback(() => setLogsOpen(false), []),
  };
}

export type PanelLayout = ReturnType<typeof usePanelLayout>;
