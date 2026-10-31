import type { ReactNode } from "react";

interface Props {
  role: "source" | "target";
  /** Replaces the role's default hint ("solo se lee", "se modifica"). */
  hint?: string;
  /** The connection's environment pill, when the end is a connection. */
  badge?: ReactNode;
  /** The end's fields (connection or folder). */
  children: ReactNode;
}

const HEADINGS = {
  source: { title: "Origen", hint: "solo se lee" },
  target: { title: "Destino", hint: "se modifica" },
};

/** One end of a sync, backup or restore: its heading with the environment pill and its fields. */
export function Endpoint({ role, hint, badge, children }: Props) {
  const heading = HEADINGS[role];
  return (
    <section className={`selection-endpoint ${role}`}>
      <header>
        <b>{heading.title}</b>
        <span className="muted small">{hint ?? heading.hint}</span>
        <span className="spacer" />
        {badge}
      </header>
      <div className="selection-endpoint-fields">{children}</div>
    </section>
  );
}
