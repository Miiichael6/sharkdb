import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";

type Tree = ReturnType<typeof syntaxTree>;

// VS Code's bracket pair colorization: `()`, `[]` and `{}` colored by depth, cycling through three
// colors (`--syn-bracket-*`). Brackets come from the syntax tree, so the ones inside strings and
// comments are left alone.
const OPEN = new Set(["(", "[", "{"]);
const CLOSE = new Set([")", "]", "}"]);
const LEVELS = [1, 2, 3].map((n) => Decoration.mark({ class: `cm-bracket-${n}` }));

/** The depth before the brackets at `pos` and after it. */
interface Checkpoint {
  pos: number;
  depth: number;
}

/**
 * A bracket's depth is counted from the start of the document, so it doesn't depend on the scroll.
 * Depths already counted are kept as checkpoints until the tree changes, so scrolling a long text
 * (a result in Texto) only counts from the nearest one instead of from the start each time.
 */
class BracketColors {
  decorations: DecorationSet;
  private tree: Tree | null = null;
  private checkpoints: Checkpoint[] = [];

  constructor(view: EditorView) {
    this.decorations = this.build(view);
  }

  update(u: ViewUpdate) {
    if (u.docChanged || u.viewportChanged || syntaxTree(u.state) !== syntaxTree(u.startState)) this.decorations = this.build(u.view);
  }

  private build(view: EditorView): DecorationSet {
    const tree = syntaxTree(view.state);
    if (tree !== this.tree) {
      this.tree = tree;
      this.checkpoints = [{ pos: 0, depth: 0 }];
    }
    const { from, to } = view.viewport;
    const start = this.checkpoints.reduce((best, c) => (c.pos <= from && c.pos > best.pos ? c : best));
    const builder = new RangeSetBuilder<Decoration>();
    let depth = start.depth;
    let atFrom: number | null = null;
    tree.iterate({
      from: start.pos,
      to,
      enter: (node) => {
        // Only the brackets in [start, to), so each is counted once across checkpoints.
        if (node.from < start.pos || node.from >= to) return;
        const open = OPEN.has(node.name);
        if (!open && !CLOSE.has(node.name)) return;
        if (atFrom === null && node.from >= from) atFrom = depth;
        if (!open) depth = Math.max(0, depth - 1);
        if (node.from >= from) builder.add(node.from, node.to, LEVELS[depth % LEVELS.length]);
        if (open) depth++;
      },
    });
    this.remember({ pos: from, depth: atFrom ?? depth });
    this.remember({ pos: to, depth });
    return builder.finish();
  }

  private remember(checkpoint: Checkpoint) {
    if (!this.checkpoints.some((c) => c.pos === checkpoint.pos)) this.checkpoints.push(checkpoint);
  }
}

export const bracketColors = ViewPlugin.fromClass(BracketColors, { decorations: (plugin) => plugin.decorations });
