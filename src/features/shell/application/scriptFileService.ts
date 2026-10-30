import type { ScriptFiles } from "./ports";

export type ScriptFileService = ReturnType<typeof createScriptFileService>;

export const SCRIPT_EXTENSION = ".js";

/** Name proposed in "save as" for a tab that has no file yet. */
export const suggestedScriptName = (title: string) =>
  title.toLowerCase().endsWith(SCRIPT_EXTENSION) ? title : `${title}${SCRIPT_EXTENSION}`;

/** Opening and saving `.js` scripts; both return null when the user cancels the dialog. */
export function createScriptFileService(files: ScriptFiles) {
  async function open(): Promise<{ path: string; content: string } | null> {
    const path = await files.pickOpen();
    return path ? { path, content: await files.read(path) } : null;
  }

  /** Saves to `path`, or asks where first when there's none (or `saveAs`). Returns the path used. */
  async function save(content: string, path: string | null, title: string, saveAs = false): Promise<string | null> {
    const target = path && !saveAs ? path : await files.pickSave(suggestedScriptName(title));
    if (!target) return null;
    await files.write(target, content);
    return target;
  }

  return { open, save };
}
