import type { ThemeSelection } from "../domain/themes";
import { openModalWindow } from "./modalWindow";
import { readThemes, saveThemes } from "./theme";

/** The "Tema" window: gets the current themes and answers the chosen ones, or nothing on Cancelar. */
export const THEME_VIEW = "theme";

const WINDOW = { title: "Tema", width: 720, height: 680, resizable: false };

/** Opens the "Tema" window and saves and applies what it answers. */
export async function openThemeWindow() {
  const chosen = await openModalWindow<ThemeSelection>(THEME_VIEW, readThemes(), WINDOW);
  if (chosen) saveThemes(chosen);
}
