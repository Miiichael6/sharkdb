import { openModalWindow } from "../../../shared/ui/modalWindow";
import type { MongoConnection } from "../domain/connection";

export const CONNECTION_FORM_VIEW = "connection-form";

export interface ConnectionFormData {
  conn: MongoConnection;
  isNew: boolean;
}

/** How the form was left: "Guardar" or "Conectar", with the edited connection. */
export type ConnectionFormResult = { kind: "save" | "connect"; conn: MongoConnection };

/**
 * Opens the connection form in its own window; resolves null on Cancelar, Escape or closing it. The
 * title bar has no title: the form's own header, which says it, moves up into it.
 */
export function openConnectionFormWindow(conn: MongoConnection, isNew: boolean) {
  return openModalWindow<ConnectionFormResult>(CONNECTION_FORM_VIEW, { conn, isNew } satisfies ConnectionFormData, {
    title: "",
    width: 620,
    height: 600,
  });
}
