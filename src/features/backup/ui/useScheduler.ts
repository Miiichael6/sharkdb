import { useEffect, useRef } from "react";
import { useServices } from "../../../app/services";

interface Options {
  /** Schedules and connections are loaded: before that every connection would look deleted. */
  ready: boolean;
  /** The schedule whose backup is running, if any. */
  runningId: string | null;
  /** Starts the first schedule due now, if any and nothing is running. */
  runDue: () => void;
}

/**
 * Runs the schedules on their own while the app is open (D15): every minute, as soon as everything
 * loaded (a run missed today with the app closed) and as soon as a backup ends (the next one waiting).
 */
export function useScheduler({ ready, runningId, runDue }: Options) {
  const { schedules: service } = useServices();
  // The minute listener lives as long as the app: it always calls the latest `runDue`.
  const latestRunDue = useRef(runDue);
  latestRunDue.current = runDue;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    let stop: (() => void) | undefined;
    let unmounted = false;
    service
      .onMinute(() => readyRef.current && latestRunDue.current())
      .then((unlisten) => (unmounted ? unlisten() : (stop = unlisten)))
      .catch(() => {});
    return () => {
      unmounted = true;
      stop?.();
    };
  }, [service]);

  useEffect(() => {
    if (ready && !runningId) latestRunDue.current();
  }, [ready, runningId]);
}
