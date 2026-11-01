import { describe, expect, it } from "vitest";
import {
  APP_THEME_CHOICES,
  APP_THEMES,
  CODE_THEMES,
  DEFAULT_APP_THEME,
  DEFAULT_CODE_THEME,
  parseAppThemeChoice,
  parseCodeTheme,
  resolveAppTheme,
} from "./themes";

const ids = (list: readonly { id: string }[]) => list.map((t) => t.id);

describe("theme catalog", () => {
  it("has unique ids in each list", () => {
    expect(new Set(ids(APP_THEME_CHOICES)).size).toBe(APP_THEME_CHOICES.length);
    expect(new Set(ids(CODE_THEMES)).size).toBe(CODE_THEMES.length);
  });

  it("keeps the current themes and has valid defaults", () => {
    expect(ids(APP_THEMES)).toEqual(expect.arrayContaining(["dark", "light"]));
    expect(ids(APP_THEMES)).toContain(DEFAULT_APP_THEME);
    expect(ids(CODE_THEMES)).toContain(DEFAULT_CODE_THEME);
    expect(DEFAULT_CODE_THEME).toBe("monokai-vibrant");
  });
});

describe("parseAppThemeChoice", () => {
  it("keeps a known choice, the system one included", () => {
    expect(parseAppThemeChoice("nord")).toBe("nord");
    expect(parseAppThemeChoice("system")).toBe("system");
  });

  it("falls back to the default for nothing stored or an unknown id", () => {
    expect(parseAppThemeChoice(null)).toBe(DEFAULT_APP_THEME);
    expect(parseAppThemeChoice("neon")).toBe(DEFAULT_APP_THEME);
  });
});

describe("parseCodeTheme", () => {
  it("keeps a known theme and falls back to the default otherwise", () => {
    expect(parseCodeTheme("one-dark")).toBe("one-dark");
    expect(parseCodeTheme(null)).toBe(DEFAULT_CODE_THEME);
    expect(parseCodeTheme("system")).toBe(DEFAULT_CODE_THEME);
  });
});

describe("resolveAppTheme", () => {
  it("is the chosen palette", () => {
    expect(resolveAppTheme("solarized-light", true)).toMatchObject({ id: "solarized-light", dark: false });
  });

  it("follows the OS on system: the default dark or light palette", () => {
    expect(resolveAppTheme("system", true).id).toBe("dark");
    expect(resolveAppTheme("system", false).id).toBe("light");
  });
});

