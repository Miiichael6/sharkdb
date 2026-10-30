import type { CompletionSource } from "@codemirror/autocomplete";
import type { SchemaService } from "../application/schemaService";
import { completionContext, suggestionsFor, type SuggestionType } from "../domain/completion";

/** CodeMirror icon class for each kind of suggestion. */
const ICON: Record<SuggestionType, string> = {
  collection: "class",
  method: "method",
  field: "property",
  operator: "keyword",
  variable: "variable",
};

const NEEDS_COLLECTIONS = new Set(["db", "collectionName"]);
const COMPLETION_TOKEN = /^[\w$.]*$/;

/** Adapts the pure completion rules to CodeMirror, with names read live from `target()`'s database. */
export function shellCompletionSource(schema: SchemaService, target: () => { sid: string; db: string }): CompletionSource {
  return async (ctx) => {
    const context = completionContext(ctx.state.sliceDoc(0, ctx.pos));
    if (!context) return null;
    // Plain identifiers only pop up on request (Ctrl+Space) or once something is typed.
    if (context.kind === "global" && !context.prefix && !ctx.explicit) return null;

    const { sid, db } = target();
    const [collections, fields] = await Promise.all([
      NEEDS_COLLECTIONS.has(context.kind) ? schema.collections(sid, db) : [],
      context.kind === "field" ? schema.fields(sid, db, context.collection) : [],
    ]);
    return {
      from: context.from,
      options: suggestionsFor(context, { collections, fields }).map((s) => ({ label: s.label, type: ICON[s.type] })),
      validFor: COMPLETION_TOKEN,
    };
  };
}
