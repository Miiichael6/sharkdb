import { windowTitle, type ActiveConnection } from "../domain/windowTitle";
import type { WindowGateway } from "./ports";

export type WindowTitleService = ReturnType<typeof createWindowTitleService>;

export function createWindowTitleService(gateway: WindowGateway) {
  return {
    /** Titles the window with the active connection, or with the app name alone when there's none. */
    show: (active?: ActiveConnection) => gateway.setTitle(windowTitle(active)),
  };
}
