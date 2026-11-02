import { useSyncExternalStore } from "react";
import { useServices } from "../../../app/services";

/** What the updater is doing, re-rendering as it changes. */
export function useUpdateStatus() {
  const { updates } = useServices();
  return useSyncExternalStore(updates.subscribe, updates.current);
}
