import { open } from "@tauri-apps/plugin-dialog";
import type { FolderPicker } from "../application/ports";

export const tauriFolderPicker: FolderPicker = {
  pickFolder: async (title) => (await open({ title, multiple: false, directory: true })) ?? null,
};
