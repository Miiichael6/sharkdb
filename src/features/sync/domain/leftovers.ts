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

/** Asked on connecting to `server` when it has `leftovers` (never empty). Lists every one of them. */
export function leftoversRequest(server: string, leftovers: Leftover[]): ConfirmRequest {
  const one = leftovers.length === 1;
  const what = one ? "una copia temporal" : `${leftovers.length} copias temporales`;
  const names = leftovers.map((l) => `• ${l.db}.${l.collection}`);
  return {
    title: "Colecciones provisionales abandonadas",
    message:
      `En ${server} hay ${what} de un sync, un restore o una copia que no terminó (la app se cerró a mitad). ` +
      `${one ? "Es una colección aparte" : "Son colecciones aparte"} (su nombre termina en .sharkdb-staging-… o empieza por sharkdb-copy-): ` +
      `borrar${one ? "la" : "las"} no afecta a tus colecciones reales, que siguen como estaban. ` +
      `Solo ocupa${one ? "" : "n"} espacio. ¿Borrar${one ? "la" : "las"}?\n\n${names.join("\n")}`,
    confirmLabel: "Borrar",
    dismissLabel: "Ahora no",
  };
}
