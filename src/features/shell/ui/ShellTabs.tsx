import type { ReactNode } from "react";
import { confirmInWindow } from "../../../shared/ui/confirmInWindow";
import { isDirty, type NewTab, type ShellTab as Tab } from "../domain/tabs";
import { ShellTab } from "./ShellTab";
import { TabBar } from "./TabBar";
import type { ScriptFileActions } from "./useScriptFileActions";
import type { ShellTabs as Tabs } from "./useShellTabs";
import { useTabShortcuts } from "./useTabShortcuts";

interface Props {
  tabs: Tabs;
  files: ScriptFileActions;
  /** The explorer's detail panel, shown while no shell tab is active. */
  details: ReactNode;
  /** Where Ctrl+T opens a tab (the explorer's selection), if anywhere. */
  newTabTarget: () => NewTab | null;
}

/** Main area: shell tabs next to the explorer's detail panel, with their keyboard shortcuts. */
export function ShellTabs({ tabs, files, details, newTabTarget }: Props) {
  const active = tabs.active;

  // Tabs with unsaved changes to their file ask first.
  const requestClose = async (tab: Tab) => {
    const close =
      !isDirty(tab) ||
      (await confirmInWindow({
        title: "Cambios sin guardar",
        message: `“${tab.title}” tiene cambios sin guardar. ¿Cerrar la pestaña igualmente?`,
        confirmLabel: "Cerrar sin guardar",
      }));
    if (close) tabs.close(tab);
  };
  const openFile = () => files.openFile(active ?? newTabTarget());

  useTabShortcuts({
    newTab: () => {
      const target = newTabTarget();
      if (target) tabs.open(target);
    },
    closeTab: () => active && requestClose(active),
    openFile,
    saveFile: (saveAs) => active && files.save(active, saveAs),
  });

  return (
    <div className="shell-area">
      <TabBar
        tabs={tabs.tabs}
        activeId={active?.id ?? null}
        onActivate={tabs.activate}
        onClose={requestClose}
        onDuplicate={tabs.duplicate}
        onRename={tabs.rename}
        onMove={tabs.move}
      />
      <div className="shell-body">
        <div className="details-tab" hidden={!!active}>
          {details}
        </div>
        {tabs.tabs.map((t) => (
          <ShellTab
            key={t.id}
            tab={t}
            active={t.id === active?.id}
            onCodeChange={(code) => tabs.setCode(t.id, code)}
            onOpenFile={openFile}
            onSave={() => files.save(t)}
          />
        ))}
      </div>
    </div>
  );
}
