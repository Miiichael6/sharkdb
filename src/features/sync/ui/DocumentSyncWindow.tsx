import { useState } from "react";
import { errorMessage } from "../../../shared/errors";
import { Endpoint } from "../../../shared/ui/Endpoint";
import { Field } from "../../../shared/ui/Field";
import { SelectionWindow } from "../../../shared/ui/SelectionWindow";
import { connectionEndpoint } from "../../connections/domain/endpoints";
import { ConnectionField } from "../../connections/ui/ConnectionField";
import { TagBadge } from "../../connections/ui/TagBadge";
import {
  documentSyncRequest,
  documentsLabel,
  syncDocumentsLabel,
  validateDocumentSync,
  type DocumentSyncRequest,
} from "../domain/documentSync";
import type { DocumentSyncWindowData } from "./documentSyncViews";
import { DocumentIdLine } from "./DocumentIdLine";
import { DocumentSyncPlace } from "./DocumentSyncPlace";
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
  const sourceEnd = connectionEndpoint(connections, source.sid);
  const targetAddress = form.targetId ? connectionEndpoint(connections, form.targetId).address : undefined;

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
          {/* Same shape as the destination, but fixed: the source is the viewer's tab. */}
          <Field label="Conexión">
            <input readOnly value={sourceEnd.name} title="El origen es la pestaña del visor" />
          </Field>
          <DocumentSyncPlace address={sourceEnd.address} db={source.db} collection={source.coll} />
        </Endpoint>
      }
      target={
        <Endpoint role="target" badge={form.target && <TagBadge tag={form.target.tag} />}>
          <ConnectionField options={form.targets} value={form.targetId} onChange={form.changeTarget} status={form.targetStatus} />
          <DocumentSyncPlace address={targetAddress} db={source.db} collection={source.coll} />
        </Endpoint>
      }
      note="Solo hacia un entorno de menor nivel: prod → QA, development o local; QA → development o local; development → local. Cada documento reemplaza al de su mismo _id."
      error={submitError}
      // Which documents go, by their _id; read whole from the source in the next window.
      children={
        <ol className="doc-sync-ids" aria-label="Documentos a sincronizar">
          {ids.map((id, i) => (
            <li key={i}>
              <DocumentIdLine id={id} index={i} />
            </li>
          ))}
        </ol>
      }
      footer={documentsLabel(ids.length)}
      ready={form.ready}
      continueLabel={syncDocumentsLabel(ids.length)}
      onContinue={submit}
      onClose={onClose}
    />
  );
}
