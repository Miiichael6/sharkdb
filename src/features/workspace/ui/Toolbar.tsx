import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { ContextMenu, type ContextMenuItem } from "../../../shared/ui/ContextMenu";
import type { StatusContext } from "../domain/statusLabel";
import { TOOLBAR_ACTIONS, TOOLBAR_LAYOUT, type ToolbarActionId } from "../domain/toolbarActions";
import { StatusPill } from "./StatusPill";
import { ToolbarButton } from "./ToolbarButton";
import type { ToolbarHandlers } from "./useToolbarShortcuts";

/** Actions that open a popup anchored to their button instead of running a handler. */
type PopupId = Extract<ToolbarActionId, "menu">;
const isPopup = (id: ToolbarActionId): id is PopupId => id === "menu";

const POPUP_GAP_PX = 4;

interface Props {
  handlers: ToolbarHandlers;
  pressed: Partial<Record<ToolbarActionId, boolean>>;
  disabled: Partial<Record<ToolbarActionId, boolean>>;
  menuItems: ContextMenuItem[];
  status: StatusContext | null;
}

/** Workspace toolbar in the style of TablePlus: button groups around the status pill. */
export function Toolbar({ handlers, pressed, disabled, menuItems, status }: Props) {
  const [popup, setPopup] = useState<{ id: PopupId; x: number; y: number } | null>(null);
  const closePopup = () => setPopup(null);

  const onButton = (id: ToolbarActionId, e: MouseEvent<HTMLButtonElement>) => {
    if (!isPopup(id)) return handlers[id]?.();
    // The popup closes on any window click; this one must not reach the window and close it again.
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup((p) => (p?.id === id ? null : { id, x: rect.left, y: rect.bottom + POPUP_GAP_PX }));
  };

  // Arrow keys move between buttons, as in any ARIA toolbar.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(".tb-btn:not(:disabled)")];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: buttons.length - 1 }[e.key]!;
    buttons[(next + buttons.length) % buttons.length]?.focus();
    e.preventDefault();
  };

  const group = (ids: ToolbarActionId[]) => (
    <div className="tb-group" key={ids.join()}>
      {ids.map((id) => (
        <ToolbarButton
          key={id}
          action={TOOLBAR_ACTIONS[id]}
          pressed={pressed[id] || popup?.id === id}
          disabled={disabled[id]}
          popup={isPopup(id)}
          onClick={(e) => onButton(id, e)}
        />
      ))}
    </div>
  );

  return (
    <div className="ws-toolbar" role="toolbar" aria-label="Barra de herramientas" onKeyDown={onKeyDown}>
      {TOOLBAR_LAYOUT.left.map(group)}
      <StatusPill status={status} />
      {TOOLBAR_LAYOUT.right.map(group)}

      {popup?.id === "menu" && (
        <ContextMenu x={popup.x} y={popup.y} items={menuItems} onClose={closePopup} label={TOOLBAR_ACTIONS.menu.label} />
      )}
    </div>
  );
}
