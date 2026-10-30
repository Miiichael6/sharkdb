import { call } from "./tauri";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reply = Record<string, any>;

/** Runs a database command (extended JSON in, relaxed extended JSON out). */
export type CommandRunner = (sid: string, db: string, command: Record<string, unknown>) => Promise<Reply>;

export const tauriCommandRunner: CommandRunner = (sid, db, command) => call<Reply>("run_command", { id: sid, db, command });

/** Documents of a cursor reply (`listCollections`, `find`…) that fit in its first batch. */
export const firstBatch = <T>(reply: Reply) => (reply.cursor?.firstBatch ?? []) as T[];
