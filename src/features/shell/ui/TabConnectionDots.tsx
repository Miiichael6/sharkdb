import type { CSSProperties } from "react";
import type { TabConnection } from "../domain/tabConnection";

/** Dots in the connections' colours at the tab's left edge (two for a split on two connections); the title stays centred. */
export function TabConnectionDots({ conns }: { conns: TabConnection[] }) {
  if (!conns.length) return null;
  return (
    <span className="tab-conn-dots" aria-hidden>
      {conns.map((c) => (
        <span key={c.id} className="tab-conn-dot" style={{ "--tab-conn-color": c.color } as CSSProperties} />
      ))}
    </span>
  );
}
