// Expand/collapse state of the explorer tree. Children come from an injected loader, so this
// hook knows nothing about MongoDB.
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../../shared/errors";
import { filterCollections } from "../domain/collectionFilter";
import { isLeaf, isWithin, parentKey, type NodeKind, type TreeNode } from "../domain/tree";

export type ChildLoader = (n: TreeNode) => Promise<TreeNode[]>;

export interface Tree {
  roots: TreeNode[];
  children: Map<string, TreeNode[]>;
  expanded: Set<string>;
  loading: Set<string>;
  errors: Map<string, string>;
  /** Text typed in each `Collections` folder's filter box; it outlives refreshes. */
  filters: Map<string, string>;
  selected: string | null;
  node: (key: string | null) => TreeNode | undefined;
  /** The closest node of `kind` among `n` and its ancestors. */
  ancestor: (n: TreeNode, kind: NodeKind) => TreeNode | undefined;
  /** Children of `key` on screen: all of them, or only those its filter lets through. */
  shownChildren: (key: string) => TreeNode[] | undefined;
  setFilter: (folderKey: string, text: string) => void;
  /** Nodes currently on screen, in display order (for keyboard navigation). */
  visible: () => TreeNode[];
  select: (key: string | null) => void;
  toggle: (n: TreeNode) => void;
  expand: (n: TreeNode) => void;
  collapse: (n: TreeNode) => void;
  /** Drops cached children of `n` (and below) and reloads them if `n` is expanded. */
  refresh: (n: TreeNode) => void;
  /** Reloads every expanded node in place, so nothing collapses; closed ones reload when opened. */
  refreshAll: () => void;
  /** Opens `n`'s ancestors and `n` itself, and selects it. */
  reveal: (n: TreeNode) => void;
}

export function useTree(roots: TreeNode[], loadChildren: ChildLoader): Tree {
  const [children, setChildren] = useState(new Map<string, TreeNode[]>());
  const [expanded, setExpanded] = useState(new Set<string>());
  const [loading, setLoading] = useState(new Set<string>());
  const [errors, setErrors] = useState(new Map<string, string>());
  const [filters, setFilters] = useState(new Map<string, string>());
  const [selected, setSelected] = useState<string | null>(null);

  // Registry of every node seen so far, so keys can be resolved back to nodes.
  const registry = useRef(new Map<string, TreeNode>());
  roots.forEach((r) => registry.current.set(r.key, r));

  const load = useCallback(
    async (n: TreeNode) => {
      setLoading((s) => new Set(s).add(n.key));
      setErrors((m) => {
        const next = new Map(m);
        next.delete(n.key);
        return next;
      });
      try {
        const kids = await loadChildren(n);
        kids.forEach((k) => registry.current.set(k.key, k));
        setChildren((m) => new Map(m).set(n.key, kids));
      } catch (e) {
        setErrors((m) => new Map(m).set(n.key, errorMessage(e)));
      } finally {
        setLoading((s) => {
          const next = new Set(s);
          next.delete(n.key);
          return next;
        });
      }
    },
    [loadChildren],
  );

  const expand = useCallback(
    (n: TreeNode) => {
      if (isLeaf(n)) return;
      setExpanded((s) => new Set(s).add(n.key));
      if (!children.has(n.key) && !loading.has(n.key)) load(n);
    },
    [children, loading, load],
  );

  const collapse = useCallback((n: TreeNode) => {
    setExpanded((s) => {
      const next = new Set(s);
      next.delete(n.key);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (n: TreeNode) => (expanded.has(n.key) ? collapse(n) : expand(n)),
    [expanded, expand, collapse],
  );

  const refresh = useCallback(
    (n: TreeNode) => {
      setChildren((m) => {
        const next = new Map(m);
        for (const k of next.keys()) if (isWithin(k, n.key)) next.delete(k);
        return next;
      });
      if (expanded.has(n.key) || n.kind === "server") {
        setExpanded((s) => new Set(s).add(n.key));
        load(n);
      }
    },
    [expanded, load],
  );

  const refreshAll = useCallback(() => {
    const open = [...children.keys()].filter((k) => expanded.has(k));
    setChildren((m) => new Map([...m].filter(([k]) => expanded.has(k))));
    open.forEach((k) => {
      const n = registry.current.get(k);
      if (n) load(n);
    });
  }, [children, expanded, load]);

  const reveal = useCallback(
    (n: TreeNode) => {
      registry.current.set(n.key, n);
      for (let k = parentKey(n.key); k; k = parentKey(k)) {
        const ancestor = registry.current.get(k);
        if (ancestor) expand(ancestor);
      }
      expand(n);
      setSelected(n.key);
    },
    [expand],
  );

  // Robo 3T opens a server's database list as soon as it connects.
  const rootKeys = roots.map((r) => r.key).join("|");
  useEffect(() => {
    roots.forEach((r) => {
      if (!children.has(r.key) && !loading.has(r.key) && !errors.has(r.key)) expand(r);
    });
    // Only react to the set of roots changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootKeys]);

  const shownChildren = useCallback(
    (key: string) => {
      const kids = children.get(key);
      return kids && filterCollections(kids, filters.get(key) ?? "");
    },
    [children, filters],
  );

  const setFilter = useCallback(
    (folderKey: string, text: string) => setFilters((m) => new Map(m).set(folderKey, text)),
    [],
  );

  const ancestor = (n: TreeNode, kind: NodeKind) => {
    for (let k: string | null = n.key; k; k = parentKey(k)) {
      const node = registry.current.get(k);
      if (node?.kind === kind) return node;
    }
  };

  const visible = useCallback(() => {
    const out: TreeNode[] = [];
    const walk = (nodes: TreeNode[]) =>
      nodes.forEach((n) => {
        out.push(n);
        if (expanded.has(n.key)) walk(shownChildren(n.key) ?? []);
      });
    walk(roots);
    return out;
  }, [roots, expanded, shownChildren]);

  return {
    roots,
    children,
    expanded,
    loading,
    errors,
    filters,
    selected,
    node: (key) => (key ? registry.current.get(key) : undefined),
    ancestor,
    shownChildren,
    setFilter,
    visible,
    select: setSelected,
    toggle,
    expand,
    collapse,
    refresh,
    refreshAll,
    reveal,
  };
}
