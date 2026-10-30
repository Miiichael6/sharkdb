import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { Session } from "../domain/session";

type IsReadOnly = (sid: string) => boolean;

const ReadOnlyContext = createContext<IsReadOnly>(() => false);

/**
 * Tells the UI which sessions are in safe mode so it can hide or disable writes. Only a
 * convenience: the backend rejects the writes anyway.
 */
export function ReadOnlyProvider({ sessions, children }: { sessions: Session[]; children: ReactNode }) {
  const isReadOnly = useCallback<IsReadOnly>(
    (sid) => sessions.some((s) => s.conn.id === sid && s.safeMode),
    [sessions],
  );
  return <ReadOnlyContext.Provider value={isReadOnly}>{children}</ReadOnlyContext.Provider>;
}

/** Whether a session (by connection id) is read-only right now. */
export const useReadOnly = () => useContext(ReadOnlyContext);
