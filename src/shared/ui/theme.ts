import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "dark" | "light" | "system";
export type Theme = "dark" | "light";

export const THEME_CHOICES: { id: ThemeChoice; label: string }[] = [
  { id: "dark", label: "Oscuro" },
  { id: "light", label: "Claro" },
  { id: "system", label: "Según el sistema" },
];

const THEME_KEY = "robo3b.theme";
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)");

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "system" ? stored : "dark";
  } catch {
    return "dark";
  }
}

const resolve = (choice: ThemeChoice): Theme => (choice === "system" ? (systemDark().matches ? "dark" : "light") : choice);

/** Puts the chosen theme on the page and on the native title bar. */
export function applyTheme(choice: ThemeChoice = readThemeChoice()) {
  document.documentElement.dataset.theme = resolve(choice);
  // The title bar follows the OS on "system"; failing here only leaves it in its own theme.
  getCurrentWindow()
    .setTheme(choice === "system" ? null : choice)
    .catch(() => {});
}

/** Applies the theme now and keeps it following the system while the choice is "system". */
export function initTheme() {
  applyTheme();
  systemDark().addEventListener("change", () => readThemeChoice() === "system" && applyTheme("system"));
}

/** The resolved theme of this window, updated when it changes. */
export function useTheme(): Theme {
  const current = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const [theme, setTheme] = useState<Theme>(current);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(current()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/** The stored choice and a setter that saves and applies it. */
export function useThemeChoice() {
  const [choice, setChoice] = useState(readThemeChoice);
  const choose = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Without storage the choice just lasts until the app closes.
    }
    applyTheme(next);
    setChoice(next);
  }, []);
  return { choice, choose };
}
