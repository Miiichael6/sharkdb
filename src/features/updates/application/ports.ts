import type { AvailableUpdate } from "../domain/update";

/** Where the new versions come from, and how one is put in place of the running app. */
export interface UpdateGateway {
  /** The newer version published, or null when this one is the latest. Rejects without network or endpoint. */
  check(): Promise<AvailableUpdate | null>;
  /**
   * Downloads the version the last `check` found, verifies its signature and installs it.
   * `onProgress` hears the bytes so far and the total, when the server tells it.
   */
  install(onProgress: (downloaded: number, total: number | undefined) => void): Promise<void>;
  /** Starts the app again, now on the installed version. */
  restart(): Promise<void>;
}
