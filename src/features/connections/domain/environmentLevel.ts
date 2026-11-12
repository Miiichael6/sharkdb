// Environment level of a connection, by its tag (D26): documents only go down, never sideways or up.
import { neverModifiedAmong, type MongoConnection, type Tag } from "./connection";

export const PRODUCTION_LEVEL = 3;
export const QA_LEVEL = 2;
export const LOCAL_LEVEL = 1;

const LEVELS: Record<Tag, number> = {
  production: PRODUCTION_LEVEL,
  testing: QA_LEVEL,
  staging: QA_LEVEL,
  development: LOCAL_LEVEL,
  local: LOCAL_LEVEL,
};

/** `production` 3, `testing`/`staging` (QA) 2, `local`/`development` 1. The backend has the same table (`sync::target`). */
export const environmentLevel = (tag: Tag) => LEVELS[tag];

/**
 * Whether documents of `source` may be synced to `target` (R104, D26): only to a lower level (prod → QA
 * or local, QA → local), and never to a protected or production connection, nor one on the same server
 * as one of `all`.
 */
export const canSyncDocumentsTo = (
  source: Pick<MongoConnection, "id" | "tag">,
  target: MongoConnection,
  all: MongoConnection[],
) => target.id !== source.id && environmentLevel(target.tag) < environmentLevel(source.tag) && !neverModifiedAmong(target, all);
