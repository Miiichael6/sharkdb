import { useEffect, useRef } from "react";
import { useServices } from "../../../app/services";
import { confirmInWindow } from "../../../shared/ui/confirmInWindow";
import { useNotify } from "../../../shared/ui/useNotifications";
import { displayName } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import { leftoversRequest } from "../domain/leftovers";

/**
 * On opening a connection that can be written to, offers to drop the provisional collections that
 * interrupted syncs, restores or copies left in it (49). Asked once per connection while the app
 * runs, so "Ahora no" isn't asked again; a session in safe mode (protected and production ones
 * always are) is skipped until it's switched off. `onDropped` runs after dropping, to refresh the tree.
 */
export function useLeftoverCleanup(sessions: Session[], onDropped: () => void) {
  const { sync } = useServices();
  const { ok, fail } = useNotify();
  const asked = useRef(new Set<string>());
  // Read when the answer comes, not when the connection opened.
  const dropped = useRef(onDropped);
  dropped.current = onDropped;

  useEffect(() => {
    for (const { conn, safeMode } of sessions) {
      if (safeMode || asked.current.has(conn.id)) continue;
      asked.current.add(conn.id);
      void (async () => {
        // Only a help on connecting: if it can't look, it says nothing.
        const leftovers = await sync.findLeftovers(conn.id).catch(() => []);
        if (!leftovers.length || !(await confirmInWindow(leftoversRequest(displayName(conn), leftovers)))) return;
        await sync.dropLeftovers(conn.id, leftovers);
        dropped.current();
        ok(leftovers.length === 1 ? "Colección provisional borrada" : `${leftovers.length} colecciones provisionales borradas`);
      })().catch(fail);
    }
  }, [sessions, sync, ok, fail]);
}
