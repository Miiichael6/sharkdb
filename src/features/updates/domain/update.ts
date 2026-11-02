// What the updater is doing, and how each event moves it on. Pure: the service feeds it the events.

/** A newer version found at the update endpoint. */
export interface AvailableUpdate {
  version: string;
  notes: string;
}

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "upToDate" }
  | ({ kind: "available" } & AvailableUpdate)
  /** `percent` is null while the size of the download is unknown. */
  | { kind: "downloading"; version: string; percent: number | null }
  | { kind: "error"; message: string };

export const IDLE: UpdateStatus = { kind: "idle" };
export const CHECKING: UpdateStatus = { kind: "checking" };

/** A check or a download is running: another one must wait. */
export const isBusy = (status: UpdateStatus): boolean =>
  status.kind === "checking" || status.kind === "downloading";

/** What a finished check found: a newer version, or none. */
export const checked = (update: AvailableUpdate | null): UpdateStatus =>
  update ? { kind: "available", ...update } : { kind: "upToDate" };

/** A check that failed: shown when the user asked for it, forgotten when it ran on its own at startup. */
export const checkFailed = (message: string, silent: boolean): UpdateStatus =>
  silent ? IDLE : { kind: "error", message };

/** How much of the download has arrived, as a whole percent (null without a known size). */
export function percentOf(downloaded: number, total: number | undefined): number | null {
  if (!total) return null;
  return Math.min(100, Math.floor((downloaded / total) * 100));
}

export const downloading = (version: string, downloaded: number, total: number | undefined): UpdateStatus => ({
  kind: "downloading",
  version,
  percent: percentOf(downloaded, total),
});

export const failed = (message: string): UpdateStatus => ({ kind: "error", message });
