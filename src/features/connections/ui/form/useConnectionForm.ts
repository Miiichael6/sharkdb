import { useState } from "react";
import { useServices } from "../../../../app/services";
import { errorMessage } from "../../../../shared/errors";
import { buildUri, fieldsFromUri, type ConnectMode, type MongoConnection } from "../../domain/connection";
import type { ServerInfo } from "../../domain/session";
import { isSshComplete } from "../../domain/ssh";

export type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; info: ServerInfo }
  | { status: "error"; message: string };

export type SetField = <K extends keyof MongoConnection>(key: K, value: MongoConnection[K]) => void;

const MONGO_URI_RE = /^mongodb(\+srv)?:\/\/.+/;
const MULTI_HOST_ERROR = "La URI tiene varios hosts o no es válida; edítala en modo URI.";

/** Form state for one connection: field edits, fields ↔ URI switch and the "Probar" check. */
export function useConnectionForm(initial: MongoConnection) {
  const { connections } = useServices();
  const [conn, setConn] = useState(initial);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [modeError, setModeError] = useState("");

  const set: SetField = (key, value) => {
    setConn((c) => ({ ...c, [key]: value }));
    setTest({ status: "idle" });
  };

  const switchMode = (mode: ConnectMode) => {
    if (mode === conn.mode) return;
    setModeError("");
    if (mode === "uri") {
      setConn((c) => ({ ...c, mode, uri: buildUri(c) }));
      return;
    }
    const fromUri = fieldsFromUri(conn, conn.uri);
    if (fromUri) setConn(fromUri);
    else setModeError(MULTI_HOST_ERROR);
  };

  const hasTarget = conn.mode === "uri" ? MONGO_URI_RE.test(conn.uri.trim()) : !!conn.host.trim();
  const canSubmit = hasTarget && isSshComplete(conn.ssh);

  const runTest = async () => {
    setTest({ status: "testing" });
    try {
      setTest({ status: "ok", info: await connections.test(conn) });
    } catch (e) {
      setTest({ status: "error", message: errorMessage(e) });
    }
  };

  return { conn, set, switchMode, modeError, canSubmit, test, runTest };
}
