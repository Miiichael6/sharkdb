import { call } from "../../../shared/infrastructure/tauri";
import type { ShellGateway } from "../application/ports";
import type { CursorBatch, ScriptOutcome } from "../domain/outcome";

export const tauriShellGateway: ShellGateway = {
  execute: (sid, db, code) => call<ScriptOutcome>("execute_script", { sid, db, code }),
  nextBatch: (sid, cursorId, size) => call<CursorBatch>("next_batch", { sid, cursorId, size }),
  closeCursor: (sid, cursorId) => call<void>("close_cursor", { sid, cursorId }),
  cancel: (sid) => call<void>("cancel_script", { sid }),
};
