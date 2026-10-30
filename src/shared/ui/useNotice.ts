import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../errors";

export type Notice = { kind: "ok" | "error"; text: string } | null;

const OK_NOTICE_MS = 3000;

/** Transient status message: successes fade out on their own, errors stay until dismissed. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (notice?.kind !== "ok") return;
    const t = setTimeout(() => setNotice(null), OK_NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  const ok = useCallback((text: string) => setNotice({ kind: "ok", text }), []);
  const fail = useCallback((e: unknown) => setNotice({ kind: "error", text: errorMessage(e) }), []);
  const dismiss = useCallback(() => setNotice(null), []);

  return { notice, ok, fail, dismiss };
}
