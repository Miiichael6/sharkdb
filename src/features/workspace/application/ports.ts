/** Opens external tools on an open server session. */
export interface TerminalGateway {
  /** Starts `mongosh` in a terminal window, connected to `db` with the session's URI (and tunnel). */
  openMongosh(sid: string, db: string): Promise<void>;
}
