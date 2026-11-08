import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type SidebarTab = "operations";

interface RightSidebarValue {
  /** The tab shown, or null while the sidebar is closed. */
  tab: SidebarTab | null;
  show: (tab: SidebarTab) => void;
  /** Shows `tab`, or closes the sidebar if it was already showing it. */
  toggle: (tab: SidebarTab) => void;
  close: () => void;
}

const RightSidebarContext = createContext<RightSidebarValue | null>(null);

/** The main window's right sidebar: background operations. */
export function RightSidebarProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<SidebarTab | null>(null);
  const show = useCallback((next: SidebarTab) => setTab(next), []);
  const toggle = useCallback((next: SidebarTab) => setTab((current) => (current === next ? null : next)), []);
  const close = useCallback(() => setTab(null), []);
  const value = useMemo(() => ({ tab, show, toggle, close }), [tab, show, toggle, close]);
  return <RightSidebarContext.Provider value={value}>{children}</RightSidebarContext.Provider>;
}

export function useRightSidebar(): RightSidebarValue {
  const value = useContext(RightSidebarContext);
  if (!value) throw new Error("useRightSidebar must be used inside <RightSidebarProvider>");
  return value;
}
