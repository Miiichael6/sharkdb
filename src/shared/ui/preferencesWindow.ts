import { openModalWindow } from "./modalWindow";

/** The "Preferencias" window: loads and saves the preferences itself, so it needs no data. */
export const PREFERENCES_VIEW = "preferences";

const WINDOW = {
  title: "Preferencias",
  width: 460,
  height: 380,
  resizable: false,
};

export function openPreferencesWindow() {
  return openModalWindow<null>(PREFERENCES_VIEW, null, WINDOW);
}
