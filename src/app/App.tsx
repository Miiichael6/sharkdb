import { useState } from "react";
import { renderSchedules } from "../features/backup/ui/renderSchedules";
import { useBackupSchedules } from "../features/backup/ui/useBackupSchedules";
import {
  displayName,
  duplicateConnection,
  newConnection,
  removeConnection,
  type MongoConnection,
} from "../features/connections/domain/connection";
import type { BorrowedSession, Session } from "../features/connections/domain/session";
import { ConnectionForm } from "../features/connections/ui/ConnectionForm";
import { DriverPicker } from "../features/connections/ui/DriverPicker";
import { ReadOnlyProvider } from "../features/connections/ui/useReadOnly";
import { TargetServerProvider } from "../features/connections/ui/useTargetServer";
import { Welcome } from "../features/connections/ui/Welcome";
import { DocumentActionsProvider } from "../features/documents/ui/DocumentActionsProvider";
import type { TreeNode } from "../features/explorer/domain/tree";
import { Workspace } from "../features/explorer/ui/Workspace";
import { ShellTabs } from "../features/shell/ui/ShellTabs";
import { useScriptFileActions } from "../features/shell/ui/useScriptFileActions";
import type { MenuScriptKind } from "../features/shell/domain/menuScripts";
import { tabForNode, useShellTabs } from "../features/shell/ui/useShellTabs";
import { usePanelLayout } from "../features/workspace/ui/usePanelLayout";
import { errorMessage } from "../shared/errors";
import { useLog } from "../shared/ui/useLog";
import { useNotify } from "../shared/ui/useNotifications";
import { useDataOperations } from "./operations/useDataOperations";
import { WithOperationsPanel } from "./operations/WithOperationsPanel";
import { useServices } from "./services";
import { useDatabaseWindow } from "./useDatabaseWindow";
import { useSavedConnections } from "./useSavedConnections";
import { useWindowSizeForView } from "./useWindowSizeForView";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import "./App.css";

type Dialog =
  | { kind: "none" }
  | { kind: "picker" }
  | { kind: "form"; conn: MongoConnection; isNew: boolean };

function App() {
  const { connections: service, explorer } = useServices();
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  // Several servers can be open at once, each one a root in the explorer (like Robo 3T).
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { connections, loaded: connectionsLoaded, persist, upsert, saveFavorites, removeFromList } =
    useSavedConnections(setError);
  const chooseDatabases = useDatabaseWindow(saveFavorites);
  useWindowSizeForView(!showWelcome && sessions.length > 0);
  const tabs = useShellTabs();
  const files = useScriptFileActions(tabs);
  const layout = usePanelLayout();
  const log = useLog();
  const notify = useNotify();

  /**
   * Opens `conn` and adds it to the explorer; throws when it can't connect. A connection with nothing
   * to show asks for its databases first, and isn't added (it closes) when that is cancelled.
   */
  const openSession = async (conn: MongoConnection) => {
    const session = await service.open(conn);
    explorer.setFavorites(conn.id, conn.favoriteDatabases);
    if (!explorer.hasPinned(conn.id)) {
      const chosen = await chooseDatabases(session, true).catch(async (e) => {
        await service.close(conn.id).catch(() => {});
        throw e;
      });
      if (!chosen) {
        await service.close(conn.id).catch(() => {});
        log.info(`Conexión a ${displayName(conn)} cancelada`);
        return null;
      }
      explorer.openTemporary(conn.id, chosen);
    }
    // Reconnecting an open connection (e.g. after editing it) replaces its session.
    setSessions((s) => [...s.filter((x) => x.conn.id !== conn.id), session]);
    log.info(`Conectado a ${displayName(conn)}`);
    return session;
  };

  const connect = async (conn: MongoConnection) => {
    setDialog({ kind: "none" });
    setError("");
    setConnectingId(conn.id);
    try {
      if (await openSession(conn)) setShowWelcome(false);
    } catch (e) {
      setError(`${displayName(conn)}: ${errorMessage(e)}`);
      log.error(`No se pudo conectar a ${displayName(conn)}`, e);
    } finally {
      setConnectingId(null);
    }
  };

  /**
   * A registered connection's session for a sync, backup or restore: the open one, or one opened apart
   * when it's closed (the explorer doesn't show it and it closes once the operation is done).
   */
  const borrowSession = async (id: string): Promise<BorrowedSession> => {
    const open = sessions.find((s) => s.conn.id === id);
    if (open) return { session: open, release: async () => {} };
    const conn = connections.find((c) => c.id === id);
    if (!conn) throw "La conexión ya no existe";
    try {
      return await service.borrow(conn);
    } catch (e) {
      log.error(`No se pudo conectar a ${displayName(conn)}`, e);
      throw e;
    }
  };

  // A backup only reads its connection: nothing to refresh when it ends.
  const data = useDataOperations(connections, () => {});
  const schedules = useBackupSchedules({
    connections,
    connectionsLoaded,
    sessions,
    borrowSession,
    run: data.startBackup,
    cancel: data.cancel,
  });

  const disconnect = async (sid: string) => {
    await service.close(sid).catch(() => {});
    tabs.closeSession(sid);
    const session = sessions.find((s) => s.conn.id === sid);
    if (session) log.info(`Desconectado de ${displayName(session.conn)}`);
    setSessions((s) => {
      const next = s.filter((x) => x.conn.id !== sid);
      if (!next.length) setShowWelcome(true);
      return next;
    });
  };

  const setSafeMode = async (sid: string, enabled: boolean) => {
    const session = sessions.find((s) => s.conn.id === sid);
    if (!session) return;
    try {
      const next = await service.setSafeMode(session, enabled);
      setSessions((s) => s.map((x) => (x.conn.id === sid ? next : x)));
      const text = `Safe mode ${enabled ? "activado" : "desactivado"} en ${displayName(session.conn)}`;
      log.info(text);
      notify.info(text);
    } catch (e) {
      notify.fail(e);
    }
  };

  const shellTab = (node: TreeNode, run = false, script?: MenuScriptKind) => {
    const session = sessions.find((s) => s.conn.id === node.sid);
    return tabForNode(node, session ? displayName(session.conn) : node.sid, run, script);
  };
  const tabFor = (selected: TreeNode | undefined) => () => (selected ? shellTab(selected) : null);
  // Dropped on the shell area, a collection opens with its default query running, as on double click.
  const [draggedCollection, setDraggedCollection] = useState<TreeNode | null>(null);

  return (
    <ReadOnlyProvider sessions={sessions}>
      <TargetServerProvider sessions={sessions}>
        <DocumentActionsProvider>
          {showWelcome || !sessions.length ? (
            <Welcome
              backups={{ onNew: schedules.create, render: (query) => renderSchedules(schedules, query) }}
              connections={connections}
              openIds={sessions.map((s) => s.conn.id)}
              connectingId={connectingId}
              error={error}
              onDismissError={() => setError("")}
              onBack={sessions.length ? () => setShowWelcome(false) : undefined}
              onNew={() => setDialog({ kind: "picker" })}
              onConnect={connect}
              onEdit={(conn) => setDialog({ kind: "form", conn, isNew: false })}
              onDuplicate={(conn) => persist([...connections, duplicateConnection(conn)])}
              onDelete={(conn) => {
                if (sessions.some((s) => s.conn.id === conn.id)) disconnect(conn.id);
                persist(removeConnection(connections, conn.id));
              }}
            />
          ) : (
            <Workspace
              sessions={sessions}
              connections={connections}
              onBorrowSession={borrowSession}
              onRemoveFromList={removeFromList}
              sidebarHidden={layout.sidebarHidden}
              logsOpen={layout.logsOpen}
              onCloseLogs={layout.closeLogs}
              onDisconnect={disconnect}
              onOpenShell={(node, script) => tabs.open(shellTab(node, true, script))}
              onRunCollection={(node) => tabs.runCollection(shellTab(node, true))}
              onDragCollection={setDraggedCollection}
              onShowDetails={tabs.showDetails}
              renderToolbar={(controls) => (
                <WorkspaceToolbar
                  controls={controls}
                  sessions={sessions}
                  connections={connections}
                  tabs={tabs}
                  files={files}
                  layout={layout}
                  newTabTarget={tabFor(controls.selected)}
                  onNewConnection={() => setDialog({ kind: "picker" })}
                  onShowConnections={() => setShowWelcome(true)}
                  onConnect={connect}
                  onSetSafeMode={setSafeMode}
                  onChooseDatabases={chooseDatabases}
                />
              )}
              renderMain={(details, selected) => (
                <WithOperationsPanel>
                  <ShellTabs
                    tabs={tabs}
                    files={files}
                    details={details}
                    newTabTarget={tabFor(selected)}
                    draggedCollection={draggedCollection && shellTab(draggedCollection, true)}
                  />
                </WithOperationsPanel>
              )}
            />
          )}

          {dialog.kind === "picker" && (
            <DriverPicker
              onClose={() => setDialog({ kind: "none" })}
              onPick={() => setDialog({ kind: "form", conn: newConnection(), isNew: true })}
            />
          )}

          {dialog.kind === "form" && (
            <ConnectionForm
              initial={dialog.conn}
              isNew={dialog.isNew}
              onClose={() => setDialog({ kind: "none" })}
              onSave={(conn) => {
                upsert(conn);
                setDialog({ kind: "none" });
              }}
              onConnect={(conn) => {
                upsert(conn);
                connect(conn);
              }}
            />
          )}
        </DocumentActionsProvider>
      </TargetServerProvider>
    </ReadOnlyProvider>
  );
}

export default App;
