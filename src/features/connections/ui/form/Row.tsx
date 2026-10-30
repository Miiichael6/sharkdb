import type { ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
}

/** Label on the left, field on the right. The label wraps the field so it's announced with it. */
export function Row({ label, children }: Props) {
  return (
    <label className="row">
      <span className="row-label">{label}</span>
      <div className="row-field">{children}</div>
    </label>
  );
}
