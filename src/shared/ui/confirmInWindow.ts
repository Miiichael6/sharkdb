import {
  CONFIRM_WINDOW_WIDTH,
  confirmWindowHeight,
  type ConfirmRequest,
  type DangerAnswer,
  type DangerConfirmRequest,
} from "../domain/confirmation";
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

export const DANGER_CONFIRM_VIEW = "danger-confirm";
const DANGER_WINDOW = { width: 560, height: 480 };

/**
 * Asks `request` in its own window: "confirm" once the confirmation word is typed, "back" to return
 * to the previous window, or null when cancelled or closed.
 */
export const confirmDangerInWindow = (request: DangerConfirmRequest) =>
  openModalWindow<DangerAnswer>(DANGER_CONFIRM_VIEW, request, { title: request.title, ...DANGER_WINDOW });

/**
 * An operation in two windows: `select` (given what was chosen before "Volver"), then `confirmation`
 * with the confirmation word. Resolves the confirmed choice, or null when cancelled at either step.
 */
export async function selectThenConfirm<T>(
  select: (previous?: T) => Promise<T | null>,
  confirmation: (choice: T) => DangerConfirmRequest,
): Promise<T | null> {
  let previous: T | undefined;
  for (;;) {
    const choice = await select(previous);
    if (!choice) return null;
    const answer = await confirmDangerInWindow(confirmation(choice));
    if (answer === "confirm") return choice;
    if (answer !== "back") return null;
    previous = choice;
  }
}
