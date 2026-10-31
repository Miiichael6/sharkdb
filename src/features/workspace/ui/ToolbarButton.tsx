import type { MouseEvent } from "react";
import { actionTitle, type ToolbarAction } from "../domain/toolbarActions";
import { ToolbarIcon } from "./ToolbarIcon";

interface Props {
  action: ToolbarAction;
  pressed?: boolean;
  disabled?: boolean;
  /** Why it's disabled, added to its tooltip. */
  disabledReason?: string;
  /** Opens a menu or a popover dialog instead of acting right away. */
  popup?: "menu" | "dialog";
  /** Small counter over the icon (e.g. unread notifications). */
  badge?: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function ToolbarButton({ action, pressed, disabled, disabledReason, popup, badge, onClick }: Props) {
  const title = disabled && disabledReason ? `${actionTitle(action)}: ${disabledReason}` : actionTitle(action);
  return (
    <button
      type="button"
      className={`tb-btn ${pressed ? "pressed" : ""}`}
      data-action={action.id}
      title={title}
      aria-label={badge ? `${action.label} (${badge})` : action.label}
      aria-pressed={action.toggle ? !!pressed : undefined}
      aria-haspopup={popup}
      disabled={disabled}
      onClick={onClick}
    >
      <ToolbarIcon id={action.id} pressed={pressed} />
      {badge && (
        <span className="tb-badge" aria-hidden>
          {badge}
        </span>
      )}
    </button>
  );
}
