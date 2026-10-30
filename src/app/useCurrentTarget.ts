import { useEffect, useState } from "react";

interface Place {
  sid: string;
  db?: string;
  coll?: string;
}

type Source = "tab" | "tree";

/** Areas whose click or focus makes them the context, even when nothing in them changes. */
const AREAS: [selector: string, source: Source][] = [
  [".explorer", "tree"],
  [".shell-area", "tab"],
];

/**
 * "Where the user is": the active shell tab or the tree's selection, whichever was used last.
 * Picking a database in the tree while a shell tab is open moves the context to that database;
 * clicking back into the tab moves it back.
 */
export function useCurrentTarget<T extends Place, S extends Place & { key: string }>(
  tab: (T & { id: string }) | undefined,
  selected: S | undefined,
): T | S | undefined {
  const [source, setSource] = useState<Source>("tab");
  const [seen, setSeen] = useState({ tab: tab?.id, tree: selected?.key });

  // Adjusted while rendering, so the change shows in the same render. A new tab wins over a
  // selection that changed with it (opening a shell from the tree selects its database too).
  if (seen.tab !== tab?.id || seen.tree !== selected?.key) {
    setSeen({ tab: tab?.id, tree: selected?.key });
    setSource(seen.tab !== tab?.id ? "tab" : "tree");
  }

  useEffect(() => {
    const onUse = (e: Event) => {
      if (!(e.target instanceof Element)) return;
      const area = AREAS.find(([selector]) => (e.target as Element).closest(selector));
      if (area) setSource(area[1]);
    };
    window.addEventListener("pointerdown", onUse, true);
    window.addEventListener("focusin", onUse, true);
    return () => {
      window.removeEventListener("pointerdown", onUse, true);
      window.removeEventListener("focusin", onUse, true);
    };
  }, []);

  return source === "tree" ? (selected ?? tab) : (tab ?? selected);
}
