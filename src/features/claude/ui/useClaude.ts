import { useSyncExternalStore } from "react";
import { useServices } from "../../../app/services";

/** The Claude tab's state, re-rendering as it changes, and the service that changes it. */
export function useClaude() {
  const { claude } = useServices();
  const state = useSyncExternalStore(claude.subscribe, claude.current);
  return { state, claude };
}
