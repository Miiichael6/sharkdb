import { CONFIRM_WINDOW_WIDTH, confirmWindowHeight, type ConfirmRequest } from "../domain/confirmation";
import { openModalWindow } from "./modalWindow";

export const CONFIRM_VIEW = "confirm";

/**
 * Asks `request` in its own window, with only a close button, while this one stays disabled.
 * Resolves true when confirmed; closing the window counts as "Cancelar".
 */
export async function confirmInWindow(request: ConfirmRequest): Promise<boolean> {
  const answer = await openModalWindow<boolean>(CONFIRM_VIEW, request, {
    title: request.title,
    width: CONFIRM_WINDOW_WIDTH,
    height: confirmWindowHeight(request.message),
    resizable: false,
  });
  return answer === true;
}
