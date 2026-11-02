import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  PAGE_SIZE_RANGE,
  parseSettings,
  TIMEOUT_RANGE,
} from "./settings";

describe("parseSettings", () => {
  it("keeps valid saved values", () => {
    const saved = {
      defaultView: "table",
      dateZone: "local",
      pageSize: 200,
      timeoutSeconds: 300,
    };
    expect(parseSettings(saved)).toEqual(saved);
  });

  it("falls back to the defaults when nothing was saved", () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("x")).toEqual(DEFAULT_SETTINGS);
  });

  it("replaces each invalid field by its default, keeping the rest", () => {
    const parsed = parseSettings({
      defaultView: "grid",
      dateZone: "mars",
      pageSize: "50",
      timeoutSeconds: 90,
    });
    expect(parsed).toEqual({ ...DEFAULT_SETTINGS, timeoutSeconds: 90 });
  });

  it("brings numbers into their range, whole", () => {
    expect(parseSettings({ pageSize: 0, timeoutSeconds: 1e9 })).toMatchObject({
      pageSize: PAGE_SIZE_RANGE.min,
      timeoutSeconds: TIMEOUT_RANGE.max,
    });
    expect(
      parseSettings({ pageSize: 25.7, timeoutSeconds: Number.NaN }),
    ).toMatchObject({
      pageSize: 25,
      timeoutSeconds: DEFAULT_SETTINGS.timeoutSeconds,
    });
  });
});
