// The registered connections: loaded once, saved on every change, plus each one's favorite databases.
import { useEffect, useRef, useState } from "react";
import { upsertConnection, withFavorites, type MongoConnection } from "../features/connections/domain/connection";
import { errorMessage } from "../shared/errors";
import { useServices } from "./services";

export function useSavedConnections(onError: (text: string) => void) {
  const { connections: service, explorer } = useServices();
  const [connections, setConnections] = useState<MongoConnection[]>([]);
  // The stars are saved from the "Bases de datos" window while it's open: always build on the latest list.
  const latest = useRef(connections);
  latest.current = connections;

  useEffect(() => {
    service.list().then(setConnections, (e) => onError(errorMessage(e)));
  }, []);

  const save = (next: MongoConnection[]) => {
    latest.current = next;
    setConnections(next);
    return service.save(next);
  };

  const persist = (next: MongoConnection[]) =>
    void save(next).catch((e) => onError(`No se pudo guardar: ${errorMessage(e)}`));

  /** Saves a connection's favorite databases; the explorer service holds them for the open session. */
  const saveFavorites = async (id: string, favorites: string[]) => {
    explorer.setFavorites(id, favorites);
    await save(withFavorites(latest.current, id, favorites));
  };

  /** "Quitar de la lista": the database leaves the explorer, and its star if it had one. */
  const removeFromList = async (sid: string, db: string) => {
    explorer.forgetTemporary(sid, db);
    const current = explorer.favoritesOf(sid);
    if (current.includes(db)) await saveFavorites(sid, current.filter((f) => f !== db));
  };

  return {
    connections,
    persist,
    upsert: (conn: MongoConnection) => persist(upsertConnection(latest.current, conn)),
    saveFavorites,
    removeFromList,
  };
}
