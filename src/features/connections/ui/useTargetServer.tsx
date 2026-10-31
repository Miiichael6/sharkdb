import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { TargetServer } from "../../../shared/domain/documentTarget";
import { displayName, hostLabel } from "../domain/connection";
import type { Session } from "../domain/session";

type ServerOf = (sid: string) => TargetServer;

const unknownServer: ServerOf = (sid) => ({ name: sid, host: "" });

const TargetServerContext = createContext<ServerOf>(unknownServer);

/** Tells the UI how the user knows each open session: name, address and environment tag. */
export function TargetServerProvider({ sessions, children }: { sessions: Session[]; children: ReactNode }) {
  const serverOf = useCallback<ServerOf>(
    (sid) => {
      const conn = sessions.find((s) => s.conn.id === sid)?.conn;
      return conn ? { name: displayName(conn), host: hostLabel(conn), tag: conn.tag } : unknownServer(sid);
    },
    [sessions],
  );
  return <TargetServerContext.Provider value={serverOf}>{children}</TargetServerContext.Provider>;
}

/** The connection behind a session id, as shown to the user. */
export const useServerOf = () => useContext(TargetServerContext);
