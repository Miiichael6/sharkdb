import { useSyncExternalStore } from "react";
import { useServices } from "../../../app/services";

/** The preferences in force, re-rendering when they change (saved here or in another window). */
export function useSettings() {
  const { settings } = useServices();
  return useSyncExternalStore(settings.subscribe, settings.current);
}
