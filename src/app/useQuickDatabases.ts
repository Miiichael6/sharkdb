// Databases for the quick open palette: the same list and order as the "Bases de datos" window.
import { useState } from "react";
import { displayName } from "../features/connections/domain/connection";
import type { Session } from "../features/connections/domain/session";
import { orderForDialog } from "../features/explorer/domain/pinnedDatabases";
import type { DatabaseCandidate } from "../features/workspace/domain/quickOpen";
import { useServices } from "./services";

export interface QuickDatabase extends DatabaseCandidate {
  sid: string;
}

/** Every database of each open connection, its favorites first; loaded each time the palette opens. */
export function useQuickDatabases(sessions: Session[]) {
  const { explorer } = useServices();
  const [databases, setDatabases] = useState<QuickDatabase[]>([]);

  const ofSession = async (s: Session): Promise<QuickDatabase[]> => {
    const sid = s.conn.id;
    const names = (await explorer.listDatabases(sid)).map((d) => d.name);
    // A missing favorite can't be opened: it's only shown in the window to unmark it.
    return orderForDialog(names, explorer.favoritesOf(sid))
      .filter((db) => names.includes(db))
      .map((db) => ({ key: `${sid}:${db}`, sid, db, connection: displayName(s.conn) }));
  };

  const load = async () => {
    setDatabases([]);
    const lists = await Promise.all(sessions.map((s) => ofSession(s).catch(() => [])));
    setDatabases(lists.flat());
  };

  return { databases, load };
}
