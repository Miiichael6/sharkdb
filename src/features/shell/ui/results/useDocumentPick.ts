import { useEffect, useRef, useState, type MouseEvent } from "react";
import { NO_PICK, pickAll, pickDocument, pickModeOf, pickedDocuments, type DocumentPick, type PickMode } from "../../domain/documentPick";

interface PickState {
  docs: unknown[];
  pick: DocumentPick;
}

/**
 * Documents picked in a page of results: click, Ctrl+click, Shift+click, Ctrl+A, and pressing the mouse
 * and dragging over several. A new page starts with nothing picked.
 */
export function useDocumentPick(docs: unknown[]) {
  const [state, setState] = useState<PickState>(() => ({ docs, pick: NO_PICK }));
  const current = state.docs === docs ? state : { docs, pick: NO_PICK };
  if (current !== state) setState(current);
  const dragging = useRef(false);

  useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const pick = (index: number, mode: PickMode) => setState((s) => ({ ...s, pick: pickDocument(s.pick, index, mode) }));

  /** Left button down on document `index`: picks it as the click's keys say and starts a drag. */
  const press = (index: number, e: MouseEvent) => {
    if (e.button !== 0) return;
    pick(index, pickModeOf(e));
    dragging.current = true;
  };

  /** The pointer reached document `index`: while dragging, the pick stretches to it. */
  const dragOver = (index: number) => {
    if (dragging.current) pick(index, "range");
  };

  /** What a right click on document `index` acts on: the picked ones if it is one of them, else just it. */
  const targetsOf = (index: number): unknown[] => {
    if (current.pick.picked.has(index)) return pickedDocuments(current.pick, docs);
    pick(index, "only");
    return [docs[index]];
  };

  return {
    picked: current.pick.picked,
    anchor: current.pick.anchor,
    pick,
    press,
    dragOver,
    pickAll: () => setState((s) => ({ ...s, pick: pickAll(docs.length) })),
    pickedDocs: () => pickedDocuments(current.pick, docs),
    targetsOf,
  };
}
