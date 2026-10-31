import { useState } from "react";
import type { Session } from "../../connections/domain/session";
import { syncSources, syncTargets, type Selection } from "../domain/syncPlan";

/** Where the sync window was opened from: the default source, and what to preselect in it. */
export interface SyncOrigin {
  sid: string;
  db?: string;
  collection?: string;
}

/** State of the sync window: source, destination, the chosen collections and the typed confirmation. */
export function useSyncForm(sessions: Session[], origin: SyncOrigin) {
  const sources = syncSources(sessions);
  const targets = syncTargets(sessions);
  const [sourceSid, setSourceSid] = useState(origin.sid);
  // By default, another connection that can be modified.
  const [targetSid, setTargetSid] = useState(
    () => (targets.find((t) => t.sid !== origin.sid && !t.blocked) ?? targets.find((t) => !t.blocked))?.sid ?? "",
  );
  const [selection, setSelection] = useState<Selection>({});
  const [confirmation, setConfirmation] = useState("");

  const changeSource = (sid: string) => {
    setSourceSid(sid);
    setSelection({});
  };
  // A new destination needs a new confirmation.
  const changeTarget = (sid: string) => {
    setTargetSid(sid);
    setConfirmation("");
  };

  const target = targets.find((t) => t.sid === targetSid);
  return {
    sources,
    targets,
    source: sources.find((s) => s.sid === sourceSid),
    target,
    sourceSid,
    targetSid,
    /** Databases the destination has now, to tell what is replaced from what is created. */
    targetDatabases: sessions.find((s) => s.conn.id === targetSid)?.info.databases.map((d) => d.name) ?? [],
    changeSource,
    changeTarget,
    selection,
    setSelection,
    confirmation,
    setConfirmation,
  };
}
