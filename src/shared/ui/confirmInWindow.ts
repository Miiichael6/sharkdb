import {
  CONFIRM_WHERE_WINDOW_WIDTH,
  CONFIRM_WINDOW_WIDTH,
  confirmWindowHeight,
  DANGER_WINDOW_WIDTH,
  dangerWindowHeight,
  type ConfirmRequest,
  type DangerAnswer,
  type DangerConfirmRequest,
} from "../domain/confirmation";
import { DELETE_WINDOW_WIDTH, deleteWindowHeight, type DeleteConfirmRequest } from "../domain/destructiveActions";
import { openModalWindow } from "./modalWindow";

export const CONFIRM_VIEW = "confirm";

/**
 * Asks `request` in its own window, with only a close button, while this one stays disabled.
 * Resolves true when confirmed; closing the window counts as "Cancelar".
 */
export async function confirmInWindow(request: ConfirmRequest): Promise<boolean> {
  const answer = await openModalWindow<boolean>(CONFIRM_VIEW, request, {
    title: request.title,
    width: request.where ? CONFIRM_WHERE_WINDOW_WIDTH : CONFIRM_WINDOW_WIDTH,
    height: confirmWindowHeight(request),
    resizable: false,
  });
  return answer === true;
}

export const DELETE_CONFIRM_VIEW = "delete-confirm";

/** Asks for a manual deletion in its own red window (D12). Resolves true when confirmed; closing it cancels. */
export async function confirmDeleteInWindow(request: DeleteConfirmRequest): Promise<boolean> {
  const answer = await openModalWindow<boolean>(DELETE_CONFIRM_VIEW, request, {
    title: request.title,
    width: DELETE_WINDOW_WIDTH,
    height: deleteWindowHeight(request),
    resizable: false,
  });
  return answer === true;
}

export const DANGER_CONFIRM_VIEW = "danger-confirm";

/**
 * Asks `request` in its own window: "confirm" once the confirmation word is typed, "back" to return
 * to the previous window, or null when cancelled or closed.
 */
export const confirmDangerInWindow = (request: DangerConfirmRequest) =>
  openModalWindow<DangerAnswer>(DANGER_CONFIRM_VIEW, request, {
    title: request.title,
    width: DANGER_WINDOW_WIDTH,
    height: dangerWindowHeight(request),
  });

/**
 * An operation in two windows: `select` (given what was chosen before "Volver"), then `ask` for the
 * confirmation. Resolves the confirmed choice, or null when cancelled at either step.
 */
export async function selectThenAsk<T>(
  select: (previous?: T) => Promise<T | null>,
  ask: (choice: T) => Promise<DangerAnswer | null>,
): Promise<T | null> {
  let previous: T | undefined;
  for (;;) {
    const choice = await select(previous);
    if (!choice) return null;
    const answer = await ask(choice);
    if (answer === "confirm") return choice;
    if (answer !== "back") return null;
    previous = choice;
  }
}

/** `selectThenAsk` with the danger window built from the choice by `confirmation`. */
export const selectThenConfirm = <T,>(
  select: (previous?: T) => Promise<T | null>,
  confirmation: (choice: T) => DangerConfirmRequest,
): Promise<T | null> => selectThenAsk(select, (choice) => confirmDangerInWindow(confirmation(choice)));
