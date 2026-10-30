import type { ReactNode } from "react";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

/** A checkbox aligned with the fields of `Row` (which can't hold it: labels don't nest). */
export function CheckRow({ checked, onChange, children }: Props) {
  return (
    <div className="row">
      <span className="row-label" />
      <label className="check row-field">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {children}
      </label>
    </div>
  );
}
