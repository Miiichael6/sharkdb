import type { ReactNode } from "react";
import type { Tag } from "../../connections/domain/connection";
import { TagBadge } from "../../connections/ui/TagBadge";

interface Props {
  role: "source" | "target";
  tag?: Tag;
  /** The connection and database fields. */
  children: ReactNode;
}

const HEADINGS = {
  source: { title: "Origen", hint: "solo se lee" },
  target: { title: "Destino", hint: "se modifica" },
};

/** One end of the sync: its environment pill in the heading and its fields side by side. */
export function SyncEndpoint({ role, tag, children }: Props) {
  const { title, hint } = HEADINGS[role];
  return (
    <section className={`sync-endpoint ${role}`}>
      <header>
        <b>{title}</b>
        <span className="muted small">{hint}</span>
        <span className="spacer" />
        {tag && <TagBadge tag={tag} />}
      </header>
      <div className="sync-endpoint-fields">{children}</div>
    </section>
  );
}
