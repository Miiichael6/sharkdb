import { openWhatsNewWindow } from "../../features/whatsNew/ui/whatsNewViews";
import type { ContextMenuItem } from "./ContextMenu";
import { openPreferencesWindow } from "./preferencesWindow";
import { openThemeWindow } from "./themeWindow";

/** The settings menu (the gear), the same on the welcome screen and in the workspace toolbar. */
export const SETTINGS_ITEMS: ContextMenuItem[] = [
  { label: "Preferencias…", hint: "Ctrl+,", onSelect: () => void openPreferencesWindow() },
  { label: "Tema…", onSelect: () => void openThemeWindow() },
  { label: "Novedades…", onSelect: () => void openWhatsNewWindow() },
];

export function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="2" />
      <path d="M6.9 1.5h2.2l.4 1.8 1.2.7 1.8-.6 1.1 1.9-1.4 1.3v1.4l1.4 1.3-1.1 1.9-1.8-.6-1.2.7-.4 1.8H6.9l-.4-1.8-1.2-.7-1.8.6-1.1-1.9 1.4-1.3V7.3L2.4 6l1.1-1.9 1.8.6 1.2-.7z" />
    </svg>
  );
}
