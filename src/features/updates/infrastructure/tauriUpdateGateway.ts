import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { errorMessage } from "../../../shared/errors";
import type { UpdateGateway } from "../application/ports";

/** The plugin's errors are in English: the ones a user can actually meet, said in Spanish. */
const PLUGIN_MESSAGES: [match: string, message: string][] = [
  ["valid release JSON", "No se encontró ninguna versión publicada"],
  ["error sending request", "No se pudo conectar con el servidor de actualizaciones"],
  ["signature", "La firma de la actualización no es válida: no se instala"],
];

function translated(e: unknown): string {
  const message = errorMessage(e);
  return PLUGIN_MESSAGES.find(([match]) => message.includes(match))?.[1] ?? message;
}

/** The update the last check found: `install` downloads this one. */
let found: Update | null = null;

export const tauriUpdateGateway: UpdateGateway = {
  async check() {
    found = await check().catch((e) => Promise.reject(translated(e)));
    return found && { version: found.version, notes: found.body ?? "" };
  },
  async install(onProgress) {
    if (!found) throw "No hay ninguna versión nueva que instalar";
    let downloaded = 0;
    let total: number | undefined;
    await found
      .downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength;
        else if (event.event === "Progress") downloaded += event.data.chunkLength;
        else return;
        onProgress(downloaded, total);
      })
      .catch((e) => Promise.reject(translated(e)));
  },
  restart: relaunch,
};
