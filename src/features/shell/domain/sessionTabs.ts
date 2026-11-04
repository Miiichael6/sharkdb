// Disconnecting a connection closes all its tabs (and their scripts) at once: what to ask first.
import type { ConfirmRequest } from "../../../shared/domain/confirmation";
import { isDirty, type ShellTab } from "./tabs";

const titles = (tabs: ShellTab[]) => tabs.map((t) => `“${t.title}”`).join(", ");

/**
 * Asked before editing open connection `name` (`tabs` are its tabs): it has to disconnect first, so a
 * tab can't keep results from the old server while its writes go to the new one.
 */
export function editOpenConnectionRequest(name: string, tabs: ShellTab[]): ConfirmRequest {
  const dirty = tabs.filter(isDirty);
  const unsaved = dirty.length ? ` (${dirty.length} con cambios sin guardar: ${titles(dirty)})` : "";
  const closing = !tabs.length
    ? ""
    : tabs.length === 1
      ? ` Se cerrará su pestaña${unsaved}.`
      : ` Se cerrarán sus ${tabs.length} pestañas${unsaved}.`;
  return {
    title: `Editar “${name}”`,
    message: `Para editar la conexión hay que desconectarla.${closing}`,
    confirmLabel: "Desconectar y editar",
  };
}

/** Asked before disconnecting or deleting connection `name` when some of its `tabs` have unsaved changes; null when none do. */
export function unsavedSessionTabsRequest(
  name: string,
  tabs: ShellTab[],
  action: "disconnect" | "delete",
): ConfirmRequest | null {
  const dirty = tabs.filter(isDirty);
  if (!dirty.length) return null;
  const verb = action === "disconnect" ? "Desconectar" : "Eliminar";
  return {
    title: "Cambios sin guardar",
    message: `“${name}” tiene pestañas con cambios sin guardar: ${titles(dirty)}. Se cerrarán sin guardar. ¿${verb} igualmente?`,
    confirmLabel: `${verb} sin guardar`,
  };
}
