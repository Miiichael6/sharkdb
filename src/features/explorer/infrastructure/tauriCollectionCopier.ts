// CollectionCopier backed by the `copy_collection` Rust command, which streams progress events.
import { listen } from "@tauri-apps/api/event";
import { call } from "../../../shared/infrastructure/tauri";
import type { CollectionCopier } from "../application/ports";
import type { CopyProgress } from "../domain/copySpec";

/** Must match `PROGRESS_EVENT` in `src-tauri/src/copy.rs`. */
const PROGRESS_EVENT = "copy-progress";

interface ProgressPayload extends CopyProgress {
  copyId: string;
}

export const tauriCollectionCopier: CollectionCopier = {
  async copy(source, target, onProgress) {
    // Several copies can run at once: each one only listens to the events tagged with its id.
    const copyId = crypto.randomUUID();
    const unlisten = await listen<ProgressPayload>(PROGRESS_EVENT, ({ payload }) => {
      if (payload.copyId === copyId) onProgress({ copied: payload.copied, total: payload.total });
    });
    try {
      return await call<number>("copy_collection", { copyId, source, target });
    } finally {
      unlisten();
    }
  },
};
