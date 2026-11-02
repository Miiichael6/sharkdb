import { call } from "../../../shared/infrastructure/tauri";
import type { ShellGateway } from "../application/ports";
import type { CursorBatch, ScriptOutcome } from "../domain/outcome";

export const tauriShellGateway: ShellGateway = {
  execute: ({ sid, tab }, db, code, scriptPath, options) =>
    call<ScriptOutcome>("execute_script", { sid, tab, db, code, scriptPath, options }),
  nextBatch: ({ sid, tab }, cursorId, size) => call<CursorBatch>("next_batch", { sid, tab, cursorId, size }),
  closeCursor: ({ sid, tab }, cursorId) => call<void>("close_cursor", { sid, tab, cursorId }),
  cancel: ({ sid, tab }) => call<void>("cancel_script", { sid, tab }),
  close: ({ sid, tab }) => call<void>("close_shell", { sid, tab }),
};
