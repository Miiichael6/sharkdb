// Title of the main window (also shown in the taskbar and Alt+Tab): which connection it points to.
import type { Tag } from "../../connections/domain/connection";
import { tagLabel } from "./statusLabel";

export const APP_TITLE = "SharkDB";

const SEPARATOR = " · ";

/** The connection the workspace points to: its name and environment tag. */
export interface ActiveConnection {
  connection: string;
  tag: Tag;
}

/** `SharkDB · <connection> · <TAG>`, or just `SharkDB` without an active connection. */
export const windowTitle = (active?: ActiveConnection) =>
  active ? [APP_TITLE, active.connection, tagLabel(active.tag)].join(SEPARATOR) : APP_TITLE;
