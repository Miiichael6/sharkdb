import { DEFAULT_SHELL_DB } from "../../shell/domain/tabs";
import type { TerminalGateway } from "./ports";

export type TerminalService = ReturnType<typeof createTerminalService>;

export function createTerminalService(gateway: TerminalGateway) {
  return {
    /** Opens mongosh on `db`, or where a shell tab would start when there's none. */
    openMongosh: (sid: string, db?: string) => gateway.openMongosh(sid, db?.trim() || DEFAULT_SHELL_DB),
  };
}
