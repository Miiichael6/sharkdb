import { useCallback } from "react";
import { useServices } from "../../../app/services";
import { useLog } from "../../../shared/ui/useLog";
import { fileName, type NewTab, type ShellTab } from "../domain/tabs";
import type { ShellTabs } from "./useShellTabs";

export type ScriptFileActions = ReturnType<typeof useScriptFileActions>;

/** Ctrl+O / Ctrl+S: `.js` scripts opened into new tabs and saved from a tab. */
export function useScriptFileActions(tabs: ShellTabs) {
  const { scriptFiles } = useServices();
  const log = useLog();

  /** Opens a script in a new tab on `target`'s server and database (nothing without a target). */
  const openFile = useCallback(
    async (target: NewTab | null | undefined) => {
      if (!target) return;
      const { sid, serverLabel, db } = target;
      try {
        const file = await scriptFiles.open();
        if (!file) return;
        tabs.open({ sid, serverLabel, db, title: fileName(file.path), code: file.content, filePath: file.path });
        log.info(`Script abierto: ${file.path}`);
      } catch (e) {
        log.error("No se pudo abrir el script", e);
      }
    },
    [scriptFiles, tabs.open, log],
  );

  const save = useCallback(
    async (tab: ShellTab, saveAs = false) => {
      try {
        const path = await scriptFiles.save(tab.code, tab.filePath, tab.title, saveAs);
        if (!path) return;
        tabs.saved(tab.id, path, tab.code);
        log.info(`Script guardado: ${path}`);
      } catch (e) {
        log.error("No se pudo guardar el script", e);
      }
    },
    [scriptFiles, tabs.saved, log],
  );

  return { openFile, save };
}
