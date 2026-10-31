import type { ContextMenuItem } from "./ContextMenu";
import { THEME_CHOICES, useThemeChoice } from "./theme";

/** The settings menu (the gear), the same on the welcome screen and in the workspace toolbar. */
export function useSettingsItems(): ContextMenuItem[] {
  const theme = useThemeChoice();
  return [
    {
      label: "Tema",
      items: THEME_CHOICES.map(({ id, label }) => ({
        label,
        checked: theme.choice === id,
        onSelect: () => theme.choose(id),
      })),
    },
  ];
}

export function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="2" />
      <path d="M6.9 1.5h2.2l.4 1.8 1.2.7 1.8-.6 1.1 1.9-1.4 1.3v1.4l1.4 1.3-1.1 1.9-1.8-.6-1.2.7-.4 1.8H6.9l-.4-1.8-1.2-.7-1.8.6-1.1-1.9 1.4-1.3V7.3L2.4 6l1.1-1.9 1.8.6 1.2-.7z" />
    </svg>
  );
}
