// Text of the toolbar's status pill: where the active tab (or the tree selection) points.
import type { Tag } from "../../connections/domain/connection";

export interface StatusContext {
  tag: Tag;
  version: string;
  connection: string;
  db?: string;
  coll?: string;
  /** Safe mode on: the session only reads. */
  safeMode?: boolean;
}

export const tagLabel = (tag: Tag) => tag.toUpperCase();

export const SAFE_MODE_LABEL = "SOLO LECTURA";

/** `MongoDB <version> : <connection> : <db> : <collection>`, leaving out what isn't set. */
export function statusLocation(ctx: StatusContext): string {
  return [`MongoDB ${ctx.version}`, ctx.connection, ctx.db, ctx.coll].filter(Boolean).join(" : ");
}

/** Full label, e.g. `PRODUCTION | SOLO LECTURA | MongoDB 7.0.2 : Clientes : shop : orders`. */
export const statusLabel = (ctx: StatusContext) =>
  [tagLabel(ctx.tag), ctx.safeMode && SAFE_MODE_LABEL, statusLocation(ctx)].filter(Boolean).join(" | ");
