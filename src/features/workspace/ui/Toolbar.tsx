import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { badgeText } from "../../../shared/domain/notifications";
import { ContextMenu, type ContextMenuItem } from "../../../shared/ui/ContextMenu";
import { NotificationCenter } from "../../../shared/ui/NotificationCenter";
import { SETTINGS_ITEMS } from "../../../shared/ui/settingsMenu";
import { useNotifications } from "../../../shared/ui/useNotifications";
import type { StatusContext } from "../domain/statusLabel";
import { TOOLBAR_ACTIONS, TOOLBAR_LAYOUT, type ToolbarActionId } from "../domain/toolbarActions";
import { WindowControls } from "../../../shared/ui/WindowControls";
import { StatusPill } from "./StatusPill";
import { ToolbarButton } from "./ToolbarButton";
import type { ToolbarHandlers } from "./useToolbarShortcuts";

/** Actions that open a popup anchored to their button instead of running a handler. */
const POPUPS = { menu: "menu", notifications: "dialog", settings: "menu" } as const;
type PopupId = keyof typeof POPUPS;
const isPopup = (id: ToolbarActionId): id is PopupId => id in POPUPS;

const POPUP_GAP_PX = 4;

interface Props {
  handlers: ToolbarHandlers;
  pressed: Partial<Record<ToolbarActionId, boolean>>;
  disabled: Partial<Record<ToolbarActionId, boolean>>;
  /** Why a disabled button can't be used, shown in its tooltip. */
  disabledReasons?: Partial<Record<ToolbarActionId, string>>;
  menuItems: ContextMenuItem[];
  status: StatusContext | null;
  /** Counters over other buttons than the notifications one (e.g. running operations). */
  badges?: Partial<Record<ToolbarActionId, string>>;
}

/** Workspace toolbar in the style of TablePlus: button groups around the status pill. */
export function Toolbar({ handlers, pressed, disabled, disabledReasons, menuItems, status, badges: extraBadges }: Props) {
  const [popup, setPopup] = useState<{ id: PopupId; x: number; y: number } | null>(null);
  const closePopup = () => setPopup(null);
  // What the hovered or focused button does, shown in the status pill.
  const [hint, setHint] = useState<string | null>(null);
  const { unread } = useNotifications();
  const badges: Partial<Record<ToolbarActionId, string>> = { ...extraBadges, notifications: unread ? badgeText(unread) : undefined };

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
          disabledReason={disabledReasons?.[id]}
          popup={isPopup(id) ? POPUPS[id] : undefined}
          badge={badges[id]}
          onClick={(e) => onButton(id, e)}
          onHint={setHint}
        />
      ))}
    </div>
  );

  return (
    // Also the window's title bar (the window has no OS one): drag it from its empty space.
    <div className="ws-toolbar" role="toolbar" aria-label="Barra de herramientas" onKeyDown={onKeyDown} data-tauri-drag-region>
      {TOOLBAR_LAYOUT.left.map(group)}
      <StatusPill status={status} hint={hint} />
      {TOOLBAR_LAYOUT.right.map(group)}
      <WindowControls />

      {popup?.id === "menu" && (
        <ContextMenu x={popup.x} y={popup.y} items={menuItems} onClose={closePopup} label={TOOLBAR_ACTIONS.menu.label} />
      )}
      {popup?.id === "settings" && (
        <ContextMenu x={popup.x} y={popup.y} items={SETTINGS_ITEMS} onClose={closePopup} label={TOOLBAR_ACTIONS.settings.label} />
      )}
      {popup?.id === "notifications" && <NotificationCenter x={popup.x} y={popup.y} onClose={closePopup} />}
    </div>
  );
}
