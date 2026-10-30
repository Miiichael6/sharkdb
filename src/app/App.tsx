import { useEffect, useState } from "react";
import {
  displayName,
  duplicateConnection,
  newConnection,
  removeConnection,
  upsertConnection,
  type MongoConnection,
} from "../features/connections/domain/connection";
import type { Session } from "../features/connections/domain/session";
import { ConnectionForm } from "../features/connections/ui/ConnectionForm";
import { DriverPicker } from "../features/connections/ui/DriverPicker";
import { Welcome } from "../features/connections/ui/Welcome";
import type { TreeNode } from "../features/explorer/domain/tree";
import { Workspace } from "../features/explorer/ui/Workspace";
import { ShellTabs } from "../features/shell/ui/ShellTabs";
import { tabForNode, useShellTabs } from "../features/shell/ui/useShellTabs";
import { errorMessage } from "../shared/errors";
import { useLog } from "../shared/ui/useLog";
import { useServices } from "./services";
import "./App.css";

type Dialog =
  | { kind: "none" }
  | { kind: "picker" }
  | { kind: "form"; conn: MongoConnection; isNew: boolean };

function App() {
  const { connections: service } = useServices();
  const [connections, setConnections] = useState<MongoConnection[]>([]);
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  // Several servers can be open at once, each one a root in the explorer (like Robo 3T).
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const tabs = useShellTabs();
  const log = useLog();

  useEffect(() => {
    service.list().then(setConnections, (e) => setError(errorMessage(e)));
  }, []);

  const persist = (next: MongoConnection[]) => {
    setConnections(next);
    service.save(next).catch((e) => setError(`No se pudo guardar: ${errorMessage(e)}`));
  };

  const upsert = (conn: MongoConnection) => persist(upsertConnection(connections, conn));

  const connect = async (conn: MongoConnection) => {
    setDialog({ kind: "none" });
    setError("");
    setConnectingId(conn.id);
    try {
      const session = await service.open(conn);
      // Reconnecting an open connection (e.g. after editing it) replaces its session.
      setSessions((s) => [...s.filter((x) => x.conn.id !== conn.id), session]);
      setShowWelcome(false);
      log.info(`Conectado a ${displayName(conn)}`);
    } catch (e) {
      setError(`${displayName(conn)}: ${errorMessage(e)}`);
      log.error(`No se pudo conectar a ${displayName(conn)}`, e);
    } finally {
      setConnectingId(null);
    }
  };

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

  const shellTab = (node: TreeNode) => {
    const session = sessions.find((s) => s.conn.id === node.sid);
    return tabForNode(node, session ? displayName(session.conn) : node.sid);
  };

  return (
    <>
      {showWelcome || !sessions.length ? (
        <Welcome
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
          onDisconnect={disconnect}
          onShowConnections={() => setShowWelcome(true)}
          onOpenShell={(node) => tabs.open(shellTab(node))}
          onShowDetails={tabs.showDetails}
          renderMain={(details, selected) => (
            <ShellTabs tabs={tabs} details={details} newTabTarget={() => (selected ? shellTab(selected) : null)} />
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
    </>
  );
}

export default App;
