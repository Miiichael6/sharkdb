import { useEffect } from "react";
import { displayName } from "../../features/connections/domain/connection";
import type { Session } from "../../features/connections/domain/session";
import { useServices } from "../services";

/** Starts the Claude tab's service and keeps its open connections in step with the sessions. */
export function useClaudeConnections(sessions: Session[]) {
  const { claude } = useServices();

  useEffect(() => void claude.start(), [claude]);

  useEffect(() => {
    claude.setOpenConnections(sessions.map((s) => ({ id: s.conn.id, name: displayName(s.conn), safeMode: s.safeMode })));
  }, [claude, sessions]);
}
