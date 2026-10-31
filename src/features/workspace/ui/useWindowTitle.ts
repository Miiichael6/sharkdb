import { useCallback, useEffect } from "react";
import { useServices } from "../../../app/services";
import { useLog } from "../../../shared/ui/useLog";
import type { ActiveConnection } from "../domain/windowTitle";

/** Keeps the window title on `active`: the app name alone when there's none or the workspace closes. */
export function useWindowTitle(active: ActiveConnection | undefined) {
  const { windowTitle } = useServices();
  const log = useLog();
  const show = useCallback(
    (next?: ActiveConnection) => void windowTitle.show(next).catch((e) => log.error("No se pudo cambiar el título de la ventana", e)),
    [windowTitle, log],
  );

  const connection = active?.connection;
  const tag = active?.tag;
  useEffect(() => show(connection && tag ? { connection, tag } : undefined), [show, connection, tag]);
  useEffect(() => () => show(), [show]);
}
