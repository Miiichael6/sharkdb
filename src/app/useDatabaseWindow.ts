// Opens the "Bases de datos" window of a connection and answers what it asks (stars, creation).
import { displayName, hostLabel } from "../features/connections/domain/connection";
import type { Session } from "../features/connections/domain/session";
import { userDatabases } from "../features/explorer/domain/mongo";
import type {
  OpenDatabaseData,
  OpenDatabaseRequest,
  OpenDatabaseResult,
} from "../features/workspace/domain/databaseChoice";
import { openModalWindow } from "../shared/ui/modalWindow";
import { OPEN_DATABASE_VIEW } from "./ModalWindow";
import { useServices } from "./services";

const WINDOW = { title: "Bases de datos", width: 520, height: 520 };

/**
 * The databases `session` must show in the explorer (the checked ones, favorites included), or null
 * when the window was closed (the stars may have changed anyway). A mandatory window has no X: its Cancelar is the only way out.
 */
export type ChooseDatabases = (session: Session, mandatory: boolean) => Promise<string[] | null>;

/** `saveFavorites` persists the stars right away, so they stay even if the window is cancelled. */
export function useDatabaseWindow(saveFavorites: (sid: string, favorites: string[]) => Promise<void>): ChooseDatabases {
  const { explorer } = useServices();

  return async (session, mandatory) => {
    const sid = session.conn.id;
    const all = await explorer.listDatabases(sid);
    // The system databases are always in the System folder: they're never offered as a choice.
    const favorites = userDatabases(explorer.favoritesOf(sid));
    const data: OpenDatabaseData = {
      connection: displayName(session.conn),
      host: hostLabel(session.conn),
      databases: userDatabases(all.map((d) => d.name)),
      favorites,
      shown: [...favorites, ...userDatabases(explorer.temporariesOf(sid))],
      mandatory,
    };
    const onRequest = async (body: unknown) => {
      const request = body as OpenDatabaseRequest;
      if (request.kind === "favorites") await saveFavorites(sid, request.favorites);
      else await explorer.createCollection(sid, request.db, request.coll);
    };
    const result = await openModalWindow<OpenDatabaseResult>(OPEN_DATABASE_VIEW, data, {
      ...WINDOW,
      closable: !mandatory,
      onRequest,
    });
    return result && result.databases;
  };
}
