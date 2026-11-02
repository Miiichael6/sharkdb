// The user's preferences: how results start out and the limits of each shell run.
import type { DateZone } from "../../shell/domain/bsonFormat";
import { DEFAULT_PAGE_SIZE } from "../../shell/domain/paging";
import { VIEW_MODES, type ViewMode } from "../../shell/domain/resultView";

export interface Settings {
  /** The view a new result opens in. */
  defaultView: ViewMode;
  /** The zone a new result shows its dates in. */
  dateZone: DateZone;
  /** Documents per page of a cursor result (and of the first batch the shell sends). */
  pageSize: number;
  /** Longest a script (or a page read) may run before it is stopped. */
  timeoutSeconds: number;
}

/** Robo 3T's defaults: tree view, UTC, pages of 50; a minute per script. */
export const DEFAULT_SETTINGS: Settings = {
  defaultView: "tree",
  dateZone: "utc",
  pageSize: DEFAULT_PAGE_SIZE,
  timeoutSeconds: 60,
};

export const PAGE_SIZE_RANGE = { min: 1, max: 1000 } as const;
export const TIMEOUT_RANGE = { min: 1, max: 3600 } as const;

const DATE_ZONES: readonly DateZone[] = ["utc", "local"];

const oneOf = <T extends string>(
  options: readonly T[],
  value: unknown,
  fallback: T,
): T => (options.includes(value as T) ? (value as T) : fallback);

/** A whole number within `range`; anything else (missing, text, NaN) is `fallback`. */
function wholeWithin(
  value: unknown,
  range: { min: number; max: number },
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.trunc(value)));
}

/**
 * The saved preferences, from whatever was stored: an older or hand-edited file may miss fields or
 * hold invalid values, and each of those falls back to its default.
 */
export function parseSettings(raw: unknown): Settings {
  const stored =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    defaultView: oneOf(
      VIEW_MODES.map((v) => v.mode),
      stored.defaultView,
      DEFAULT_SETTINGS.defaultView,
    ),
    dateZone: oneOf(DATE_ZONES, stored.dateZone, DEFAULT_SETTINGS.dateZone),
    pageSize: wholeWithin(
      stored.pageSize,
      PAGE_SIZE_RANGE,
      DEFAULT_SETTINGS.pageSize,
    ),
    timeoutSeconds: wholeWithin(
      stored.timeoutSeconds,
      TIMEOUT_RANGE,
      DEFAULT_SETTINGS.timeoutSeconds,
    ),
  };
}
