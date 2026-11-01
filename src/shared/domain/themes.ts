// The color themes the app offers. Each id has its palette in `src/app/themes/<kind>-<id>.css`.

export interface ThemeOption<Id extends string = string> {
  id: Id;
  label: string;
  /** A dark palette: the native title bar and the editor follow it. */
  dark: boolean;
}

export const APP_THEMES = [
  { id: "dark", label: "Oscuro", dark: true },
  { id: "light", label: "Claro", dark: false },
  { id: "nord", label: "Nord", dark: true },
  { id: "solarized-light", label: "Solarized claro", dark: false },
  { id: "dracula", label: "Dracula", dark: true },
  { id: "monokai", label: "Monokai", dark: true },
  { id: "monokai-pro", label: "Monokai Pro", dark: true },
  { id: "monokai-machine", label: "Monokai Pro (Machine)", dark: true },
] as const satisfies readonly ThemeOption[];

export const CODE_THEMES = [
  { id: "monokai-vibrant", label: "Monokai Vibrant", dark: true },
  { id: "monokai", label: "Monokai", dark: true },
  { id: "monokai-pro", label: "Monokai Pro", dark: true },
  { id: "monokai-machine", label: "Monokai Pro (Machine)", dark: true },
  { id: "one-dark", label: "One Dark", dark: true },
  { id: "light", label: "Claro", dark: false },
  { id: "github-light", label: "GitHub claro", dark: false },
  { id: "dracula", label: "Dracula", dark: true },
  { id: "solarized-dark", label: "Solarized oscuro", dark: true },
] as const satisfies readonly ThemeOption[];

export type AppThemeId = (typeof APP_THEMES)[number]["id"];
export type CodeThemeId = (typeof CODE_THEMES)[number]["id"];

/** Not a palette: picks the default dark or light one, as the OS does. */
export const SYSTEM_THEME = "system";
export type AppThemeChoice = AppThemeId | typeof SYSTEM_THEME;

/** What the user picked for each: the app and the code. */
export interface ThemeSelection {
  app: AppThemeChoice;
  code: CodeThemeId;
}

export const DEFAULT_APP_THEME: AppThemeId = "dark";
export const DEFAULT_CODE_THEME: CodeThemeId = "monokai-vibrant";
const SYSTEM_DARK: AppThemeId = "dark";
const SYSTEM_LIGHT: AppThemeId = "light";

/** What the app theme list shows: the palettes plus "Según el sistema". */
export const APP_THEME_CHOICES: readonly { id: AppThemeChoice; label: string }[] = [
  ...APP_THEMES,
  { id: SYSTEM_THEME, label: "Según el sistema" },
];

const isAppChoice = (id: string): id is AppThemeChoice => APP_THEME_CHOICES.some((t) => t.id === id);
const isCodeTheme = (id: string): id is CodeThemeId => CODE_THEMES.some((t) => t.id === id);

/** A stored app choice, or the default when there is none or it's no longer offered. */
export const parseAppThemeChoice = (stored: string | null): AppThemeChoice =>
  stored !== null && isAppChoice(stored) ? stored : DEFAULT_APP_THEME;

/** A stored code theme, or the default when there is none or it's no longer offered. */
export const parseCodeTheme = (stored: string | null): CodeThemeId =>
  stored !== null && isCodeTheme(stored) ? stored : DEFAULT_CODE_THEME;

/** The palette a choice stands for; "system" is the default dark or light one. */
export function resolveAppTheme(choice: AppThemeChoice, systemDark: boolean): ThemeOption<AppThemeId> {
  const id = choice === SYSTEM_THEME ? (systemDark ? SYSTEM_DARK : SYSTEM_LIGHT) : choice;
  return APP_THEMES.find((t) => t.id === id)!;
}
