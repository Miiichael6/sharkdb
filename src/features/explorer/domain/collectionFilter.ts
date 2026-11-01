import { childCount, type TreeNode } from "./tree";

// Filter of a database's collections while typing (R53). Every word of the query must appear in the
// name, ignoring case and accents: "al02 pre" finds "ALEMANIA_AL02_Pre…".

/** A `Collections` folder shows the filter box from this many collections on. */
export const FILTER_MIN_COLLECTIONS = 15;

/** Half-open range `[start, end)` of a name to highlight. */
export interface MatchRange {
  start: number;
  end: number;
}

export interface LabelSegment {
  text: string;
  match: boolean;
}

/** Folds one character the way names are compared: lower case, without accents. */
const fold = (ch: string) => ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** The folded name, and for each of its characters the index of the original one it comes from. */
function foldWithOrigins(name: string): { folded: string; origins: number[] } {
  let folded = "";
  const origins: number[] = [];
  let i = 0;
  for (const ch of name) {
    const f = fold(ch);
    folded += f;
    for (let k = 0; k < f.length; k++) origins.push(i);
    i += ch.length;
  }
  return { folded, origins };
}

const queryWords = (query: string) => fold(query).split(/\s+/).filter(Boolean);

export const isFilterActive = (query: string) => queryWords(query).length > 0;

/** Ranges of `name` that match `query`, sorted and merged; `null` when some word is missing. */
export function matchName(name: string, query: string): MatchRange[] | null {
  const { folded, origins } = foldWithOrigins(name);
  const ranges: MatchRange[] = [];
  for (const word of queryWords(query)) {
    const at = folded.indexOf(word);
    if (at < 0) return null;
    const last = origins[at + word.length - 1];
    ranges.push({ start: origins[at], end: last + charLength(name, last) });
  }
  return mergeRanges(ranges);
}

const charLength = (s: string, i: number) => (s.codePointAt(i)! > 0xffff ? 2 : 1);

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: MatchRange[] = [];
  for (const r of sorted) {
    const prev = out[out.length - 1];
    if (prev && r.start <= prev.end) prev.end = Math.max(prev.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/** `label` cut into plain and highlighted pieces. */
export function labelSegments(label: string, ranges: MatchRange[]): LabelSegment[] {
  const out: LabelSegment[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) out.push({ text: label.slice(at, r.start), match: false });
    out.push({ text: label.slice(r.start, r.end), match: true });
    at = r.end;
  }
  if (at < label.length) out.push({ text: label.slice(at), match: false });
  return out;
}

/** Collections shown under a `Collections` folder: all its children, or the matching collections only. */
export function filterCollections(children: TreeNode[], query: string): TreeNode[] {
  if (!isFilterActive(query)) return children;
  return children.filter((n) => n.kind === "collection" && matchName(n.label, query));
}

export const showsFilter = (children: TreeNode[]) => childCount(children) >= FILTER_MIN_COLLECTIONS;
