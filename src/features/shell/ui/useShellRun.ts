import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/services";
import { errorMessage } from "../../../shared/errors";
import { useLog } from "../../../shared/ui/useLog";
import type { CursorPager } from "../application/cursorPager";
import { elapsedText, type ScriptOutcome } from "../domain/outcome";
import { atEditorLines, SCRIPT_START, type RunOrigin } from "../domain/runOrigin";
import type { ShellTab } from "../domain/tabs";

export interface RunState {
  running: boolean;
  outcome: ScriptOutcome | null;
  /** Pager of each cursor result, by result index. */
  pagers: Map<number, CursorPager>;
  /** The run couldn't even start (shell gone, connection lost…). */
  failure: string | null;
}

const IDLE: RunState = { running: false, outcome: null, pagers: new Map(), failure: null };

/**
 * Runs scripts in a tab's shell, recording each run in the history and the log. `origin` is where the
 * code starts in the editor, so a selection's results and error carry the editor's lines.
 */
export function useShellRun(tab: ShellTab) {
  const { shell, history } = useServices();
  const log = useLog();
  const [state, setState] = useState(IDLE);
  const pagers = useRef(state.pagers);
  pagers.current = state.pagers;
  const ref = { sid: tab.sid, tab: tab.id };

  const freeCursors = () => pagers.current.forEach((p) => p.close().catch(() => {}));
  useEffect(() => freeCursors, []);

  const run = useCallback(
    async (code: string, origin: RunOrigin = SCRIPT_START) => {
      if (!code.trim()) return;
      freeCursors();
      setState({ ...IDLE, running: true });
      const where = `${tab.serverLabel} · ${tab.db}`;
      history.record(tab.sid, { code, db: tab.db, at: Date.now() }).catch((e) => log.error("No se pudo guardar el historial", e));
      try {
        const outcome = atEditorLines(await shell.execute(ref, tab.db, code), origin);
        const next = new Map<number, CursorPager>();
        outcome.results.forEach((r, i) => r.kind === "cursor" && next.set(i, shell.pager(ref, r)));
        setState({ running: false, outcome, pagers: next, failure: null });
        if (outcome.error) {
          const at = outcome.error.line ? ` (línea ${outcome.error.line})` : "";
          log.error(`Error en ${where}${at}: ${outcome.error.message}`);
        } else {
          log.info(`Script ejecutado en ${where} (${elapsedText(outcome.elapsedMs)})`);
        }
      } catch (e) {
        setState({ ...IDLE, failure: errorMessage(e) });
        log.error(`No se pudo ejecutar en ${where}`, e);
      }
    },
    [tab.sid, tab.id, tab.db, tab.serverLabel],
  );

  const cancel = useCallback(() => {
    shell.cancel(ref).catch((e) => log.error("No se pudo detener el script", e));
  }, [tab.sid, tab.id]);

  return { ...state, run, cancel };
}
