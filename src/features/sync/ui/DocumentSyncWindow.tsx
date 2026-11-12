import { useState } from "react";
import { errorMessage } from "../../../shared/errors";
import { Endpoint } from "../../../shared/ui/Endpoint";
import { SelectionWindow } from "../../../shared/ui/SelectionWindow";
import { connectionEndpoint } from "../../connections/domain/endpoints";
import { ConnectionField } from "../../connections/ui/ConnectionField";
import { TagBadge } from "../../connections/ui/TagBadge";
import {
  NO_DOCUMENT_TARGET,
  documentSyncRequest,
  documentsLabel,
  validateDocumentSync,
  type DocumentSyncRequest,
} from "../domain/documentSync";
import type { DocumentSyncWindowData } from "./documentSyncViews";
import { useDocumentSyncForm } from "./useDocumentSyncForm";

interface Props {
  data: DocumentSyncWindowData;
  /** "Continuar": the validated request, for the main window to read the documents and confirm. */
  onDone: (request: DocumentSyncRequest) => void;
  onClose: () => void;
}

/** First window of "Sincronizar con otro entorno…" from the viewer (R97, D26): fixed source, lower-level destination. */
export function DocumentSyncWindow({ data, onDone, onClose }: Props) {
  const { connections, source, ids } = data;
  const [submitError, setSubmitError] = useState("");
  const form = useDocumentSyncForm(data);
  const origin = connections.find((c) => c.id === source.sid);
  const namespace = `${source.db}.${source.coll}`;

  const submit = () => {
    try {
      onDone(validateDocumentSync(documentSyncRequest(source, form.targetId, ids), connections));
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  };

  return (
    <SelectionWindow
      source={
        <Endpoint role="source" badge={origin && <TagBadge tag={origin.tag} />}>
          <b className="ellipsis">{connectionEndpoint(connections, source.sid).name}</b>
          <span className="mono small ellipsis" title={namespace}>
            {namespace}
          </span>
        </Endpoint>
      }
      target={
        <Endpoint role="target" badge={form.target && <TagBadge tag={form.target.tag} />}>
          <ConnectionField options={form.targets} value={form.targetId} onChange={form.changeTarget} status={form.targetStatus} />
          <span className="mono small ellipsis" title={namespace}>
            {namespace}
          </span>
        </Endpoint>
      }
      note="Solo hacia un entorno de menor nivel: prod → QA o local, QA → local. Cada documento reemplaza al de su mismo _id."
      error={submitError || (form.targets.length ? "" : NO_DOCUMENT_TARGET)}
      footer={documentsLabel(ids.length)}
      ready={form.ready}
      onContinue={submit}
      onClose={onClose}
    />
  );
}
