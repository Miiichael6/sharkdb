import { useEffect, useRef } from "react";

interface Props {
  state: "none" | "partial" | "complete";
  onChange: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}

/** A checkbox that also shows "some" (indeterminate), e.g. a database with only some collections chosen. */
export function TriStateCheckbox({ state, onChange, disabled, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "partial";
  }, [state]);
  return (
    <input ref={ref} type="checkbox" checked={state === "complete"} onChange={onChange} disabled={disabled} aria-label={rest["aria-label"]} />
  );
}
