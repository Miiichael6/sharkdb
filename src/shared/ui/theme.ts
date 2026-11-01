import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  parseAppThemeChoice,
  parseCodeTheme,
  resolveAppTheme,
  SYSTEM_THEME,
  type AppThemeChoice,
  type ThemeSelection,
} from "../domain/themes";

const APP_THEME_KEY = "sharkdb.theme";
const CODE_THEME_KEY = "sharkdb.codeTheme";
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)");

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The saved themes; an unknown or missing value is the default one. */
export function readThemes(): ThemeSelection {
  return { app: parseAppThemeChoice(readStored(APP_THEME_KEY)), code: parseCodeTheme(readStored(CODE_THEME_KEY)) };
}

/** The palette id an app choice shows right now ("system" follows the OS). */
export const appThemeId = (choice: AppThemeChoice) => resolveAppTheme(choice, systemDark().matches).id;

/** Puts the themes on the page (`data-theme`, `data-code-theme`) and the app theme on the native title bar. */
export function applyThemes({ app, code }: ThemeSelection = readThemes()) {
  const palette = resolveAppTheme(app, systemDark().matches);
  document.documentElement.dataset.theme = palette.id;
  document.documentElement.dataset.codeTheme = code;
  // The title bar follows the OS on "system"; failing here only leaves it in its own theme.
  getCurrentWindow()
    .setTheme(app === SYSTEM_THEME ? null : palette.dark ? "dark" : "light")
    .catch(() => {});
}

/** Saves the themes and applies them here; the other open windows pick them up from the storage event. */
export function saveThemes(themes: ThemeSelection) {
  try {
    localStorage.setItem(APP_THEME_KEY, themes.app);
    localStorage.setItem(CODE_THEME_KEY, themes.code);
  } catch {
    // Without storage the choice just lasts until the app closes.
  }
  applyThemes(themes);
}

/**
 * Applies the themes now and keeps them current: following the system while the choice is "system",
 * and following what another window saved.
 */
export function initTheme() {
  applyThemes();
  systemDark().addEventListener("change", () => readThemes().app === SYSTEM_THEME && applyThemes());
  window.addEventListener("storage", (e) => (e.key === APP_THEME_KEY || e.key === CODE_THEME_KEY) && applyThemes());
}
