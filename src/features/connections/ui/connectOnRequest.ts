import type { BorrowedSession, Session } from "../domain/session";

/**
 * The opener's side of `useConnectionsOnDemand`: `connect` answers the window's requests by borrowing
 * the connection (opened apart when it's closed), and `sessions` keeps the ones borrowed, so a window
 * reopened after "Volver" knows them. `release` gives them all back.
 */
export function connectOnRequest(initial: Session[], borrowSession: (id: string) => Promise<BorrowedSession>) {
  let open = initial;
  const releases: Array<() => Promise<void>> = [];
  return {
    sessions: () => open,
    connect: async (id: unknown) => {
      const { session, release } = await borrowSession(String(id));
      releases.push(release);
      open = [...open.filter((s) => s.conn.id !== session.conn.id), session];
      return session;
    },
    release: () => Promise.all(releases.splice(0).map((release) => release().catch(() => {}))).then(() => {}),
  };
}
