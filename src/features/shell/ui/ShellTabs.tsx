import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "../../../shared/ui/common";
import { isDirty, type NewTab, type ShellTab as Tab } from "../domain/tabs";
import { ShellTab } from "./ShellTab";
import { TabBar } from "./TabBar";
import { useScriptFileActions } from "./useScriptFileActions";
import type { ShellTabs as Tabs } from "./useShellTabs";
import { useTabShortcuts } from "./useTabShortcuts";

interface Props {
  tabs: Tabs;
  /** Content of the pinned "Detalles" tab. */
  details: ReactNode;
  /** Where Ctrl+T opens a tab (the explorer's selection), if anywhere. */
  newTabTarget: () => NewTab | null;
}

/** Main area: shell tabs next to the explorer's detail panel, with their keyboard shortcuts. */
export function ShellTabs({ tabs, details, newTabTarget }: Props) {
  const files = useScriptFileActions(tabs);
  const [closing, setClosing] = useState<Tab | null>(null);
  const active = tabs.active;

  // Tabs with unsaved changes to their file ask first.
  const requestClose = (tab: Tab) => (isDirty(tab) ? setClosing(tab) : tabs.close(tab));
  const openFile = () => {
    const target = active ?? newTabTarget();
    if (target) files.openFile({ sid: target.sid, serverLabel: target.serverLabel, db: target.db });
  };

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
        onShowDetails={tabs.showDetails}
        onActivate={tabs.activate}
        onClose={requestClose}
        onDuplicate={tabs.duplicate}
        onRename={tabs.rename}
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

      {closing && (
        <ConfirmDialog
          title="Cambios sin guardar"
          message={`“${closing.title}” tiene cambios sin guardar. ¿Cerrar la pestaña igualmente?`}
          confirmLabel="Cerrar sin guardar"
          onConfirm={() => {
            tabs.close(closing);
            setClosing(null);
          }}
          onCancel={() => setClosing(null)}
        />
      )}
    </div>
  );
}
