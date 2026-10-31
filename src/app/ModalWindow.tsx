// What a window opened with `openModalWindow` renders instead of the app.
import { useCallback, useEffect, useState } from "react";
import { TAGS } from "../features/connections/domain/connection";
import { TagBadge } from "../features/connections/ui/TagBadge";
import {
  DOCUMENT_EDITOR_VIEW,
  DocumentEditorWindow,
  type DocumentEditorData,
} from "../features/documents/ui/DocumentEditorWindow";
import { SyncSelectWindow } from "../features/sync/ui/SyncSelectWindow";
import { SYNC_VIEW, type SyncWindowData } from "../features/sync/ui/syncViews";
import { OpenDatabaseDialog, type DatabaseChoice } from "../features/workspace/ui/OpenDatabaseDialog";
import type { ConfirmRequest, DangerConfirmRequest } from "../shared/domain/confirmation";
import { CONFIRM_VIEW, DANGER_CONFIRM_VIEW } from "../shared/ui/confirmInWindow";
import { ConfirmWindow } from "../shared/ui/ConfirmWindow";
import { DangerConfirmWindow } from "../shared/ui/DangerConfirmWindow";
import { finishModalWindow, receiveModalData } from "../shared/ui/modalWindow";
import { createServices, ServicesProvider } from "./services";
import "./App.css";

export const OPEN_DATABASE_VIEW = "open-database";

export function ModalWindow({ view }: { view: string }) {
  const [data, setData] = useState<unknown>();
  useEffect(() => receiveModalData(view, (d) => setData(() => d)), [view]);
  const done = useCallback((result: unknown) => void finishModalWindow(view, result), [view]);
  if (data === undefined) return null;

  switch (view) {
    case CONFIRM_VIEW:
      return <ConfirmWindow request={data as ConfirmRequest} onDone={done} />;
    case OPEN_DATABASE_VIEW:
      return <OpenDatabaseDialog databases={data as DatabaseChoice[]} onDone={done} />;
    case DOCUMENT_EDITOR_VIEW:
      return (
        <ServicesProvider services={createServices()}>
          <DocumentEditorWindow data={data as DocumentEditorData} onDone={done} />
        </ServicesProvider>
      );
    case DANGER_CONFIRM_VIEW: {
      const request = data as DangerConfirmRequest;
      const tag = TAGS.find((t) => t === request.target.tag);
      return <DangerConfirmWindow request={request} targetBadge={tag && <TagBadge tag={tag} />} onDone={done} />;
    }
    case SYNC_VIEW:
      return (
        <ServicesProvider services={createServices()}>
          <SyncSelectWindow data={data as SyncWindowData} onDone={done} onClose={() => done(null)} />
        </ServicesProvider>
      );
    default:
      return null;
  }
}
