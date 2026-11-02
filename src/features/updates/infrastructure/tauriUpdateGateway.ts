import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import type { UpdateGateway } from "../application/ports";

/** The update the last check found: `install` downloads this one. */
let found: Update | null = null;

export const tauriUpdateGateway: UpdateGateway = {
  async check() {
    found = await check();
    return found && { version: found.version, notes: found.body ?? "" };
  },
  async install(onProgress) {
    if (!found) throw "No hay ninguna versión nueva que instalar";
    let downloaded = 0;
    let total: number | undefined;
    await found.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength;
      else if (event.event === "Progress") downloaded += event.data.chunkLength;
      else return;
      onProgress(downloaded, total);
    });
  },
  restart: relaunch,
};
