import { useState } from "react";
import type { CollectionRef, CopyProgress, CopyRequest } from "../domain/copySpec";

/** State of the copy dialog: destination (connection, database, name), indexes and progress. */
export function useCopyForm(source: CollectionRef) {
  // By default, the same name on the same connection: only the database has to be chosen.
  const [target, setTarget] = useState<CollectionRef>({ ...source, db: "" });
  const [copyIndexes, setCopyIndexes] = useState(true);
  const [progress, setProgress] = useState<CopyProgress | null>(null);

  const changeTarget = (change: Partial<CollectionRef>) => setTarget((t) => ({ ...t, ...change }));
  const request: CopyRequest = { source, target, copyIndexes };

  return { target, changeTarget, copyIndexes, setCopyIndexes, progress, setProgress, request };
}
