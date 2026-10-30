import { useState, type FormEvent } from "react";
import { errorMessage } from "../../../shared/errors";

/** Shows the error inside the dialog instead of closing it, so the user can fix the input. */
export function useSubmit(onSubmit: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return { busy, error, setError, submit };
}
