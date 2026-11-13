// Environment level of a connection, by its tag (D26): documents only go down, never sideways or up.
import { neverModifiedAmong, type MongoConnection, type Tag } from "./connection";

export const PRODUCTION_LEVEL = 4;
export const QA_LEVEL = 3;
export const DEVELOPMENT_LEVEL = 2;
export const LOCAL_LEVEL = 1;

const LEVELS: Record<Tag, number> = {
  production: PRODUCTION_LEVEL,
  testing: QA_LEVEL,
  staging: QA_LEVEL,
  development: DEVELOPMENT_LEVEL,
  local: LOCAL_LEVEL,
};

const LEVEL_NAMES: Record<number, string> = {
  [PRODUCTION_LEVEL]: "producción",
  [QA_LEVEL]: "QA",
  [DEVELOPMENT_LEVEL]: "development",
  [LOCAL_LEVEL]: "local",
};

/** The level of `tag` as the user reads it: "producción", "QA", "development" or "local". */
export const environmentLevelName = (tag: Tag) => LEVEL_NAMES[LEVELS[tag]];

/** `production` 4, `testing`/`staging` (QA) 3, `development` 2, `local` 1. The backend has the same table (`sync::target`). */
export const environmentLevel = (tag: Tag) => LEVELS[tag];

/**
 * Whether documents of `source` may be synced to `target` (R104, D26): only to a lower level (prod → QA,
 * development or local; QA → development or local; development → local), and never to a protected or production connection, nor one on the same server
 * as one of `all`.
 */
export const canSyncDocumentsTo = (
  source: Pick<MongoConnection, "id" | "tag">,
  target: MongoConnection,
  all: MongoConnection[],
) => target.id !== source.id && environmentLevel(target.tag) < environmentLevel(source.tag) && !neverModifiedAmong(target, all);
