import type { MouseEvent } from "react";
import { actionTitle, type ToolbarAction } from "../domain/toolbarActions";
import { ToolbarIcon } from "./ToolbarIcon";

interface Props {
  action: ToolbarAction;
  pressed?: boolean;
  disabled?: boolean;
  /** Opens a menu or popover instead of acting right away. */
  popup?: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function ToolbarButton({ action, pressed, disabled, popup, onClick }: Props) {
  return (
    <button
      type="button"
      className={`tb-btn ${pressed ? "pressed" : ""}`}
      title={actionTitle(action)}
      aria-label={action.label}
      aria-pressed={action.toggle ? !!pressed : undefined}
      aria-haspopup={popup ? "menu" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <ToolbarIcon id={action.id} />
    </button>
  );
}
