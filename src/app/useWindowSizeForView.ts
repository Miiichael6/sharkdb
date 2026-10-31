// The main window is small on the connections screen and grows for the workspace.
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";

const WELCOME_SIZE = { width: 760, height: 500 };
const WORKSPACE_SIZE = { width: 1200, height: 780 };

/** Resizes and centers the window when switching views; a maximized window is left alone. */
export function useWindowSizeForView(inWorkspace: boolean) {
  const first = useRef(true);
  useEffect(() => {
    // On start the window already has the welcome size from tauri.conf.json.
    if (first.current) {
      first.current = false;
      return;
    }
    const { width, height } = inWorkspace ? WORKSPACE_SIZE : WELCOME_SIZE;
    const win = getCurrentWindow();
    void (async () => {
      if (await win.isMaximized()) return;
      await win.setSize(new LogicalSize(width, height));
      await win.center();
    })().catch(() => {});
  }, [inWorkspace]);
}
