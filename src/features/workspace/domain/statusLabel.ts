// Text of the toolbar's status pill: where the active tab (or the tree selection) points.
import type { Tag } from "../../connections/domain/connection";

export interface StatusContext {
  tag: Tag;
  version: string;
  connection: string;
  db?: string;
  coll?: string;
}

export const tagLabel = (tag: Tag) => tag.toUpperCase();

/** `MongoDB <version> : <connection> : <db> : <collection>`, leaving out what isn't set. */
export function statusLocation(ctx: StatusContext): string {
  return [`MongoDB ${ctx.version}`, ctx.connection, ctx.db, ctx.coll].filter(Boolean).join(" : ");
}

/** Full label, e.g. `PRODUCTION | MongoDB 7.0.2 : Clientes : shop : orders`. */
export const statusLabel = (ctx: StatusContext) => `${tagLabel(ctx.tag)} | ${statusLocation(ctx)}`;
