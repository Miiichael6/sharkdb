// Workspace toolbar actions: the single source for the toolbar, its shortcuts and the
// quick-open palette. Pure data plus the shortcut matching, no React.

export type ToolbarActionId =
  | "toggleSidebar"
  | "menu"
  | "connections"
  | "databases"
  | "openMongosh"
  | "openConnection"
  | "openDatabase"
  | "quickActions"
  | "refresh"
  | "safeMode"
  | "operations"
  | "notifications"
  | "logs"
  | "settings";

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
  openConnection: {
    id: "openConnection",
    label: "Abrir conexión",
    shortcuts: [{ key: "k", ctrl: true, shift: true, inEditor: true }],
  },
  openDatabase: { id: "openDatabase", label: "Abrir base de datos", shortcuts: [{ key: "k", ctrl: true, inEditor: true }] },
  quickActions: {
    id: "quickActions",
    label: "Acciones rápidas de base de datos",
    shortcuts: [{ key: ".", ctrl: true, inEditor: true }],
  },
  refresh: {
    id: "refresh",
    label: "Refrescar el workspace",
    shortcuts: [{ key: "r", ctrl: true, inEditor: true }, { key: "F5" }],
  },
  safeMode: { id: "safeMode", label: "Safe mode: solo lectura en esta conexión", shortcuts: [], toggle: true },
  operations: { id: "operations", label: "Operaciones en segundo plano", shortcuts: [], toggle: true },
  notifications: { id: "notifications", label: "Notificaciones", shortcuts: [] },
  logs: { id: "logs", label: "Logs", shortcuts: [], toggle: true },
  settings: { id: "settings", label: "Ajustes", shortcuts: [] },
};

/** Button groups left and right of the status pill, as in TablePlus. */
export const TOOLBAR_LAYOUT: { left: ToolbarActionId[][]; right: ToolbarActionId[][] } = {
  left: [
    ["toggleSidebar", "menu", "connections"],
    ["databases", "openMongosh"],
    ["openConnection", "openDatabase", "quickActions"],
  ],
  right: [["refresh"], ["safeMode"], ["operations", "notifications", "logs"], ["settings"]],
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
