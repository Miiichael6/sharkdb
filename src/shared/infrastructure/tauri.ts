import { invoke } from "@tauri-apps/api/core";

/** Thin wrapper over Tauri's `invoke`, so only adapters depend on the Tauri package. */
export const call = <T>(command: string, args?: Record<string, unknown>) => invoke<T>(command, args);
