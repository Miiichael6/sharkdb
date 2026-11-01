import { useEffect, useRef, type KeyboardEvent } from "react";
import { isFilterActive } from "../domain/collectionFilter";
import type { TreeNode } from "../domain/tree";

interface Props {
  value: string;
  /** Children of the folder the filter lets through. */
  shown: TreeNode[];
  /** Left padding, to line up with the collections below. */
  indent: number;
  /** Ctrl+F asked for this box: it takes the focus once it is on screen. */
  focusRequested: boolean;
  onChange: (text: string) => void;
  onFocused: () => void;
  /** ↓: moves to the first row of the list. */
  onSelect: (n: TreeNode) => void;
  /** Enter with a single collection left: opens it. */
  onOpen: (n: TreeNode) => void;
  /** Escape on an empty box: back to the tree. */
  onLeave: () => void;
}

/**
 * "Filtrar colecciones…" box, first row of a `Collections` folder with many collections, plus the
 * "nothing matches" row when it empties the list (R53).
 */
export function CollectionFilter({ value, shown, indent, focusRequested, onChange, onFocused, onSelect, onOpen, onLeave }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusRequested) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    onFocused();
  }, [focusRequested, onFocused]);

  const onKeyDown = (e: KeyboardEvent) => {
    // The tree handles arrows and Enter on its own: none of the box's keys reach it.
    e.stopPropagation();
    const collections = shown.filter((n) => n.kind === "collection");
    if (e.key === "Escape") {
      if (value) onChange("");
      else onLeave();
    } else if (e.key === "ArrowDown") {
      if (shown.length) onSelect(shown[0]);
    } else if (e.key === "Enter") {
      if (isFilterActive(value) && collections.length === 1) onOpen(collections[0]);
    } else return;
    e.preventDefault();
  };

  return (
    <>
      <li role="none" className="tree-filter" style={{ paddingLeft: indent }}>
        <input
          ref={inputRef}
          className="search"
          type="search"
          placeholder="Filtrar colecciones…"
          aria-label="Filtrar colecciones"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </li>
      {!shown.length && (
        <li role="none" className="tree-empty" style={{ paddingLeft: indent }}>
          Ninguna colección coincide
        </li>
      )}
    </>
  );
}
