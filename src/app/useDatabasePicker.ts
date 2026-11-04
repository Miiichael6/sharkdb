// Opens the "Abrir base de datos" window of a connection and a shell on the database picked there.
import { displayName, hostLabel } from "../features/connections/domain/connection";
import type { Session } from "../features/connections/domain/session";
import { orderForDialog } from "../features/explorer/domain/pinnedDatabases";
import { databaseNode, serverNode } from "../features/explorer/domain/tree";
import type { WorkspaceControls } from "../features/explorer/ui/Workspace";
import {
  DATABASE_PICKER_VIEW,
  splitAddress,
  type DatabasePickerData,
  type DatabasePickerResult,
} from "../features/workspace/domain/databasePicker";
import type { PanelLayout } from "../features/workspace/ui/usePanelLayout";
import { openModalWindow } from "../shared/ui/modalWindow";
import { useLog } from "../shared/ui/useLog";
import { useServices } from "./services";

const WINDOW = { title: "Abrir base de datos", width: 480, height: 540 };

/** Every database of `session`, favorites first; the picked one opens (as temporary if it isn't listed yet) with a shell. */
export function useDatabasePicker(controls: WorkspaceControls, layout: PanelLayout) {
  const { explorer } = useServices();
  const log = useLog();

  return async (session: Session) => {
    const sid = session.conn.id;
    let result: DatabasePickerResult | null;
    try {
      const names = (await explorer.listDatabases(sid)).map((d) => d.name);
      const favorites = explorer.favoritesOf(sid).filter((db) => names.includes(db));
      const data: DatabasePickerData = {
        connection: displayName(session.conn),
        tag: session.conn.tag,
        ...splitAddress(hostLabel(session.conn)),
        // A missing favorite can't be opened: it's only shown in "Bases de datos" to unmark it.
        databases: orderForDialog(names, favorites),
        favorites,
      };
      result = await openModalWindow<DatabasePickerResult>(DATABASE_PICKER_VIEW, data, WINDOW);
    } catch (e) {
      log.error("No se pudo abrir la lista de bases de datos", e);
      return;
    }
    if (!result) return;
    layout.showSidebar();
    controls.openDatabases(sid, [result.db]);
    controls.runAction("openShell", databaseNode(serverNode(sid, displayName(session.conn)), result.db));
  };
}
