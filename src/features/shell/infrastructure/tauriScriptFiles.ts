import { open, save } from "@tauri-apps/plugin-dialog";
import { call } from "../../../shared/infrastructure/tauri";
import type { ScriptFiles } from "../application/ports";

const SCRIPT_FILTERS = [
  { name: "Scripts JavaScript", extensions: ["js"] },
  { name: "Todos los archivos", extensions: ["*"] },
];

export const tauriScriptFiles: ScriptFiles = {
  pickOpen: async () => (await open({ title: "Abrir script", filters: SCRIPT_FILTERS, multiple: false, directory: false })) ?? null,
  pickSave: async (suggestedName) => (await save({ title: "Guardar script", defaultPath: suggestedName, filters: SCRIPT_FILTERS })) ?? null,
  read: (path) => call<string>("read_script", { path }),
  write: (path, content) => call<void>("write_script", { path, content }),
};
