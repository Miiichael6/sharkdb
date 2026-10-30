import { fieldPaths } from "../domain/completion";
import type { SchemaSource } from "./ports";

export type SchemaService = ReturnType<typeof createSchemaService>;

/** Documents sampled to guess a collection's fields. */
export const FIELD_SAMPLE_SIZE = 20;
/** Cached names are reused for this long, so new collections or fields show up soon after. */
export const SCHEMA_TTL_MS = 30_000;

/** Collection names and field paths for autocompletion, cached briefly per database/collection. */
export function createSchemaService(source: SchemaSource, now: () => number = Date.now) {
  const cache = new Map<string, { at: number; value: Promise<string[]> }>();

  function cached(key: string, load: () => Promise<string[]>): Promise<string[]> {
    const hit = cache.get(key);
    if (hit && now() - hit.at < SCHEMA_TTL_MS) return hit.value;
    // Failures (no permissions, dropped collection…) just mean no suggestions.
    const value = load().catch(() => []);
    cache.set(key, { at: now(), value });
    return value;
  }

  return {
    collections: (sid: string, db: string) =>
      cached(JSON.stringify([sid, db]), () => source.listCollections(sid, db)),
    fields: (sid: string, db: string, coll: string) =>
      cached(JSON.stringify([sid, db, coll]), async () =>
        fieldPaths(await source.sampleDocuments(sid, db, coll, FIELD_SAMPLE_SIZE)),
      ),
  };
}
