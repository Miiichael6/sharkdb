import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { OperationsService } from "../../shared/application/operationsService";
import { closeWithRunningConfirmation, runningOperations } from "../../shared/domain/operations";
import { confirmInWindow } from "../../shared/ui/confirmInWindow";

/** How long closing waits for cancelled operations to clean up (staging collections, partial files). */
const CANCEL_WAIT_MS = 10_000;

/** Resolves once no operation runs, or after `timeoutMs`. */
function whenNoneRunning(service: OperationsService, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const check = () => !runningOperations(service.list()).length && done();
    const stop = service.subscribe(check);
    const timer = setTimeout(() => done(), timeoutMs);
    function done() {
      stop();
      clearTimeout(timer);
      resolve();
    }
    check();
  });
}

/** Closing the main window with operations running asks first, then cancels them before closing. */
export function useCancelOnClose(service: OperationsService) {
  useEffect(() => {
    const mainWindow = getCurrentWindow();
    const stop = mainWindow.onCloseRequested(async (e) => {
      const running = runningOperations(service.list());
      if (!running.length) return;
      e.preventDefault();
      const confirmed = await confirmInWindow(closeWithRunningConfirmation(running.length));
      if (!confirmed) return;
      running.forEach((op) => service.cancel(op.id));
      await whenNoneRunning(service, CANCEL_WAIT_MS);
      await mainWindow.destroy();
    });
    return () => void stop.then((unlisten) => unlisten());
  }, [service]);
}
