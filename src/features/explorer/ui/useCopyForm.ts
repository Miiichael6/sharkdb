import { useState } from "react";
import type { CollectionRef, CopyRequest } from "../domain/copySpec";

/** State of the copy dialog: destination (database, name) and indexes. */
export function useCopyForm(source: CollectionRef) {
  // By default, the same name: only the database has to be chosen.
  const [target, setTarget] = useState({ db: "", coll: source.coll });
  const [copyIndexes, setCopyIndexes] = useState(true);

  const changeTarget = (change: Partial<CopyRequest["target"]>) => setTarget((t) => ({ ...t, ...change }));
  const request: CopyRequest = { source, target, copyIndexes };

  return { target, changeTarget, copyIndexes, setCopyIndexes, request };
}
