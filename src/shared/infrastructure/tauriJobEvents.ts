import { listen } from "@tauri-apps/api/event";
import type { JobEvents } from "../application/jobRunner";
import type { CollectionUpdate } from "../domain/collectionProgress";
import type { JobProgress } from "../domain/jobs";
import { call } from "./tauri";

const PROGRESS_EVENT = "job-progress";
const COLLECTION_EVENT = "job-collection";

export const tauriJobEvents: JobEvents = {
  onProgress: (listener) => listen<JobProgress>(PROGRESS_EVENT, (e) => listener(e.payload)),
  onCollection: (listener) => listen<CollectionUpdate>(COLLECTION_EVENT, (e) => listener(e.payload)),
  cancel: (job) => call("cancel_job", { job }),
};
