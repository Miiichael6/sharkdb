import type { ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
}

/** A labelled form control, label above it. */
export function Field({ label, children }: Props) {
  return (
    <label className="stack">
      <span className="muted">{label}</span>
      {children}
    </label>
  );
}
