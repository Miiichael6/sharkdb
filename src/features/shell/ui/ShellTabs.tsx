import { useRef, useState, type ReactNode } from "react";
import { confirmInWindow } from "../../../shared/ui/confirmInWindow";
import { NodeIcon } from "../../explorer/ui/NodeIcon";
import type { BarEntry } from "../domain/splitTabs";
import { isDirty, type NewTab, type ShellTab as Tab } from "../domain/tabs";
import { ShellTab } from "./ShellTab";
import { SplitDivider } from "./SplitDivider";
import { SplitDropZones, type DropTarget } from "./SplitDropZones";
import { COLUMNS_ICON } from "./splitIcons";
import { TabBar } from "./TabBar";
import type { ScriptFileActions } from "./useScriptFileActions";
import type { ShellTabs as Tabs } from "./useShellTabs";
import { useSplitLayout } from "./useSplitLayout";
import { useTabShortcuts } from "./useTabShortcuts";

interface Props {
  tabs: Tabs;
  files: ScriptFileActions;
  /** The explorer's detail panel, shown while no shell tab is active. */
  details: ReactNode;
  /** Where Ctrl+T opens a tab (the explorer's selection), if anywhere. */
  newTabTarget: () => NewTab | null;
  /** Tab for the collection being dragged out of the explorer, if any. */
  draggedCollection: NewTab | null;
}

/** Something dragged onto the shell area, and what dropping it does. */
interface Incoming {
  title: string;
  icon: ReactNode;
  /** Can open beside the shown tab (else only in a tab of its own). */
  beside: boolean;
  drop: (target: DropTarget) => void;
}

/**
 * Main area: shell tabs next to the explorer's detail panel, with their keyboard shortcuts. A tab
 * dragged out of the bar onto the area opens beside the shown one (a split tab); a collection dragged
 * from the explorer too, or in a tab of its own when there's no shell tab shown.
 */
export function ShellTabs({ tabs, files, details, newTabTarget, draggedCollection }: Props) {
  const active = tabs.active;
  const body = useRef<HTMLDivElement>(null);
  const layout = useSplitLayout(body, active?.id, tabs.activeSplit);
  const [draggedOut, setDraggedOut] = useState<string | null>(null);
  const dragged = tabs.entries.find((e) => e.id === draggedOut);
  // Beside a shown shell tab only (the detail panel isn't split), and wide enough for two panes.
  const beside = layout.canSplit && !!active;

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
  const closeEntry = async (entry: BarEntry) => {
    for (const pane of entry.panes) await requestClose(pane);
  };
  const openFile = () => files.openFile(active ?? newTabTarget());

  const incoming: Incoming | null =
    dragged && beside && dragged.id !== tabs.activeEntryId
      ? {
          title: dragged.panes[dragged.activePane].title,
          icon: COLUMNS_ICON,
          beside,
          drop: (target) => target !== "whole" && tabs.split(dragged.id, target),
        }
      : draggedCollection
        ? {
            title: draggedCollection.coll ?? draggedCollection.db,
            icon: <NodeIcon kind="collection" size={14} />,
            beside,
            drop: (target) => (target === "whole" ? tabs.open(draggedCollection) : tabs.openAside(draggedCollection, target)),
          }
        : null;

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
        entries={tabs.entries}
        activeId={tabs.activeEntryId}
        onActivate={tabs.activate}
        onClose={closeEntry}
        onDuplicate={tabs.duplicate}
        onRename={tabs.rename}
        onMove={tabs.move}
        onSeparate={tabs.separate}
        dragOut={setDraggedOut}
      />
      <div ref={body} className="shell-body">
        <div className="details-tab" hidden={!!active}>
          {details}
        </div>
        {tabs.tabs.map((t) => {
          const pane = layout.pane(t.id);
          return (
            <ShellTab
              key={t.id}
              tab={t}
              shown={pane.shown}
              activePane={pane.activePane}
              style={pane.style}
              onFocus={() => t.id !== active?.id && tabs.focus(t.id)}
              onCodeChange={(code) => tabs.setCode(t.id, code)}
              onOpenFile={openFile}
              onSave={() => files.save(t)}
            />
          );
        })}
        {layout.shownSplit && (
          <SplitDivider
            area={body}
            ratio={layout.ratio}
            order={layout.dividerOrder}
            onChange={(ratio) => tabs.setRatio(layout.shownSplit!.left, ratio)}
          />
        )}
        {incoming && (
          <SplitDropZones
            area={body}
            ratio={incoming.beside ? layout.ratio : null}
            title={incoming.title}
            icon={incoming.icon}
            onDrop={incoming.drop}
          />
        )}
      </div>
    </div>
  );
}
