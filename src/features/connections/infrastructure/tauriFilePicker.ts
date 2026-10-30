import { open } from "@tauri-apps/plugin-dialog";
import type { FilePicker } from "../application/ports";

export const tauriFilePicker: FilePicker = {
  pick: async (title) => (await open({ title, multiple: false, directory: false })) ?? null,
};
