import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { appendLog, type LogEntry, type LogLevel } from "../domain/log";
import { errorMessage } from "../errors";

interface LogWriter {
  info: (text: string) => void;
  error: (text: string, cause?: unknown) => void;
}

interface LogView {
  entries: LogEntry[];
  clear: () => void;
}

// Split so components that only write don't re-render on every new entry.
const WriterContext = createContext<LogWriter | null>(null);
const ViewContext = createContext<LogView | null>(null);

/** Application-wide log (connections, scripts, errors) shown in the Logs panel. */
export function LogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const writer = useMemo<LogWriter>(() => {
    const add = (level: LogLevel, text: string) => setEntries((e) => appendLog(e, { level, at: Date.now(), text }));
    return {
      info: (text) => add("info", text),
      error: (text, cause) => add("error", cause === undefined ? text : `${text}: ${errorMessage(cause)}`),
    };
  }, []);
  const clear = useCallback(() => setEntries([]), []);
  const view = useMemo(() => ({ entries, clear }), [entries, clear]);

  return (
    <WriterContext.Provider value={writer}>
      <ViewContext.Provider value={view}>{children}</ViewContext.Provider>
    </WriterContext.Provider>
  );
}

function required<T>(value: T | null): T {
  if (!value) throw new Error("Log hooks must be used inside <LogProvider>");
  return value;
}

/** Adds entries to the log. */
export const useLog = () => required(useContext(WriterContext));

/** The log's entries, for the Logs panel. */
export const useLogEntries = () => required(useContext(ViewContext));
