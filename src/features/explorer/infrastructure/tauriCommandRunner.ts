import { call } from "../../../shared/infrastructure/tauri";
import type { Doc } from "../domain/mongo";
import type { CommandRunner } from "./commandMongoAdmin";

export const tauriCommandRunner: CommandRunner = (sid, db, command) =>
  call<Doc>("run_command", { id: sid, db, command });
