// Workspace toolbar actions: the single source for the toolbar, its shortcuts and (later) the
// quick-open palette. Pure data plus the shortcut matching, no React.

export type ToolbarActionId =
  | "toggleSidebar"
  | "menu"
  | "connections"
  | "databases"
  | "openMongosh"
  | "refresh"
  | "logs";

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  /** Also fires while typing in the script editor (otherwise the editor keeps the key). */
  inEditor?: boolean;
}

export interface ToolbarAction {
  id: ToolbarActionId;
  label: string;
  shortcuts: Shortcut[];
  /** On/off actions show their state with `aria-pressed`. */
  toggle?: boolean;
}

export const TOOLBAR_ACTIONS: Record<ToolbarActionId, ToolbarAction> = {
  toggleSidebar: {
    id: "toggleSidebar",
    label: "Mostrar u ocultar el panel de bases de datos",
    shortcuts: [{ key: "b", ctrl: true, inEditor: true }],
    toggle: true,
  },
  menu: { id: "menu", label: "Menú", shortcuts: [] },
  connections: { id: "connections", label: "Conexiones", shortcuts: [] },
  databases: { id: "databases", label: "Bases de datos", shortcuts: [] },
  openMongosh: { id: "openMongosh", label: "Abrir mongosh", shortcuts: [] },
  refresh: {
    id: "refresh",
    label: "Refrescar el workspace",
    shortcuts: [{ key: "r", ctrl: true, inEditor: true }, { key: "F5" }],
  },
  logs: { id: "logs", label: "Logs", shortcuts: [], toggle: true },
};

/** Button groups left and right of the status pill, as in TablePlus. */
export const TOOLBAR_LAYOUT: { left: ToolbarActionId[][]; right: ToolbarActionId[][] } = {
  left: [
    ["toggleSidebar", "menu", "connections"],
    ["databases", "openMongosh"],
  ],
  right: [["refresh"], ["logs"]],
};

export const shortcutLabel = (s: Shortcut) =>
  [s.ctrl && "Ctrl", s.shift && "Shift", s.key.length === 1 ? s.key.toUpperCase() : s.key].filter(Boolean).join("+");

/** Tooltip text: the label followed by its shortcuts. */
export function actionTitle(action: ToolbarAction): string {
  const keys = action.shortcuts.map(shortcutLabel).join(" / ");
  return keys ? `${action.label} (${keys})` : action.label;
}

export interface KeyPress {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

const matches = (s: Shortcut, e: KeyPress) =>
  e.key.toLowerCase() === s.key.toLowerCase() &&
  !!s.ctrl === (e.ctrlKey || e.metaKey) &&
  !!s.shift === e.shiftKey &&
  !e.altKey;

/** The toolbar action a key press triggers, if any. */
export function actionForKey(e: KeyPress, inEditor: boolean): ToolbarActionId | null {
  const action = Object.values(TOOLBAR_ACTIONS).find((a) =>
    a.shortcuts.some((s) => matches(s, e) && (s.inEditor || !inEditor)),
  );
  return action?.id ?? null;
}
