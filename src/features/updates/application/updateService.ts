import { errorMessage } from "../../../shared/errors";
import {
  CHECKING,
  checked,
  checkFailed,
  downloading,
  failed,
  IDLE,
  isBusy,
  type UpdateStatus,
} from "../domain/update";
import type { UpdateGateway } from "./ports";

export type UpdateService = ReturnType<typeof createUpdateService>;

/**
 * The app's updater: one quiet check at startup, another each time the user asks, and the install of the
 * version found. `current` is read synchronously, so the screen shows the status as it changes.
 */
export function createUpdateService(gateway: UpdateGateway) {
  let current: UpdateStatus = IDLE;
  const listeners = new Set<(status: UpdateStatus) => void>();

  const set = (next: UpdateStatus) => {
    current = next;
    listeners.forEach((listener) => listener(current));
  };

  async function check(silent: boolean) {
    if (isBusy(current)) return;
    set(CHECKING);
    try {
      set(checked(await gateway.check()));
    } catch (e) {
      set(checkFailed(errorMessage(e), silent));
    }
  }

  return {
    current: () => current,
    /** At startup: without network or endpoint, nothing is shown. */
    checkOnStartup: () => check(true),
    /** The "Buscar actualizaciones" button: its outcome, error included, is shown. */
    checkNow: () => check(false),
    /** Installs the version found and restarts on it; does nothing unless one is available. */
    async install() {
      if (current.kind !== "available") return;
      const { version } = current;
      set(downloading(version, 0, undefined));
      try {
        await gateway.install((downloaded, total) => set(downloading(version, downloaded, total)));
      } catch (e) {
        set(failed(errorMessage(e)));
        return;
      }
      await gateway.restart();
    },
    /** Calls `listener` with each change; returns the function that stops it. */
    subscribe(listener: (status: UpdateStatus) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
