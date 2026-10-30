import type { Tag } from "../domain/connection";

export function TagBadge({ tag }: { tag: Tag }) {
  return <span className={`tag tag-${tag}`}>{tag}</span>;
}
