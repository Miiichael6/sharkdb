import { call } from "../../../shared/infrastructure/tauri";
import type { DocumentEval, DocumentParser } from "../application/ports";

export const tauriDocumentParser: DocumentParser = {
  evaluate: (text) => call<DocumentEval>("eval_document", { text }),
};
