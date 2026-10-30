/** Adapters reject with plain strings (Tauri forwards the Rust `Err(String)`); anything else is unexpected. */
export function errorMessage(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
}
