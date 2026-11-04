import type { ConfirmRequest } from "../../../shared/domain/confirmation";

/**
 * A provisional collection that a sync, restore or collection copy left behind when it was cut short
 * (the app closed or crashed halfway). The backend only reports old ones: a recent one may belong
 * to a job still running in another window or instance.
 */
export interface Leftover {
  db: string;
  collection: string;
}

/** How many are named in the question; the rest are only counted. */
const LISTED = 8;

/** Asked on connecting to `server` when it has `leftovers` (never empty). */
export function leftoversRequest(server: string, leftovers: Leftover[]): ConfirmRequest {
  const what = leftovers.length === 1 ? "una colección provisional" : `${leftovers.length} colecciones provisionales`;
  const names = leftovers.slice(0, LISTED).map((l) => `• ${l.db}.${l.collection}`);
  if (leftovers.length > LISTED) names.push(`… y ${leftovers.length - LISTED} más`);
  return {
    title: "Colecciones provisionales abandonadas",
    message:
      `En ${server} hay ${what} de un sync, un restore o una copia que no terminó (la app se cerró a mitad). ` +
      `No son datos válidos y ocupan espacio. ¿Borrarlas?\n\n${names.join("\n")}`,
    confirmLabel: "Borrar",
    dismissLabel: "Ahora no",
  };
}
