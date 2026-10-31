// Documents picked in a page of results, to delete several at once (Ctrl+click, Shift+click, Ctrl+A).

/** Indexes of the picked documents of the page, and where a Shift range starts. */
export interface DocumentPick {
  picked: ReadonlySet<number>;
  anchor: number;
}

export const NO_PICK: DocumentPick = { picked: new Set(), anchor: -1 };

/** `only`: plain click; `toggle`: Ctrl+click; `range`: Shift+click, from the anchor. */
export type PickMode = "only" | "toggle" | "range";

export const pickModeOf = (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): PickMode =>
  e.shiftKey ? "range" : e.ctrlKey || e.metaKey ? "toggle" : "only";

const between = (a: number, b: number) =>
  Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);

/** The pick after clicking document `index` with `mode`; a range keeps its anchor so it can be stretched again. */
export function pickDocument(pick: DocumentPick, index: number, mode: PickMode): DocumentPick {
  if (mode === "range" && pick.anchor >= 0) return { picked: new Set(between(pick.anchor, index)), anchor: pick.anchor };
  if (mode === "toggle") {
    const picked = new Set(pick.picked);
    if (picked.has(index)) picked.delete(index);
    else picked.add(index);
    return { picked, anchor: index };
  }
  return { picked: new Set([index]), anchor: index };
}

/** Every document of a page of `count`. */
export const pickAll = (count: number): DocumentPick => ({ picked: new Set(between(0, count - 1)), anchor: 0 });

/** The picked documents, in page order. */
export const pickedDocuments = <T>(pick: DocumentPick, docs: T[]): T[] => docs.filter((_, i) => pick.picked.has(i));
