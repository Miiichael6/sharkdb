// What a window opened with `openModalWindow` renders instead of the app.
import { useCallback, useEffect, useState } from "react";
import { BackupWindow } from "../features/backup/ui/BackupWindow";
import { BACKUP_VIEW, RESTORE_VIEW, type BackupWindowData, type RestoreWindowData } from "../features/backup/ui/backupViews";
import { RestoreWindow } from "../features/backup/ui/RestoreWindow";
import { TAGS } from "../features/connections/domain/connection";
import {
  OPEN_CONNECTION_VIEW,
  OpenConnectionDialog,
  type OpenConnectionData,
} from "../features/connections/ui/OpenConnectionDialog";
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
import { ModalTitleBar } from "../shared/ui/ModalTitleBar";
import { currentModalTitle, finishModalWindow, receiveModalData } from "../shared/ui/modalWindow";
import { createServices, ServicesProvider } from "./services";
import "./App.css";

export const OPEN_DATABASE_VIEW = "open-database";

/** The modal's own title bar over its view; the bar shows right away, the view once its data arrives. */
export function ModalWindow({ view }: { view: string }) {
  const [data, setData] = useState<unknown>();
  useEffect(() => receiveModalData(view, (d) => setData(() => d)), [view]);
  const done = useCallback((result: unknown) => void finishModalWindow(view, result), [view]);

  return (
    <div className="modal-window">
      <ModalTitleBar title={currentModalTitle()} />
      <div className="modal-window-body">{data !== undefined && <ModalView view={view} data={data} done={done} />}</div>
    </div>
  );
}

function ModalView({ view, data, done }: { view: string; data: unknown; done: (result: unknown) => void }) {
  switch (view) {
    case CONFIRM_VIEW:
      return <ConfirmWindow request={data as ConfirmRequest} onDone={done} />;
    case OPEN_CONNECTION_VIEW:
      return <OpenConnectionDialog data={data as OpenConnectionData} onDone={done} />;
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
    case BACKUP_VIEW:
      return (
        <ServicesProvider services={createServices()}>
          <BackupWindow data={data as BackupWindowData} onDone={done} onClose={() => done(null)} />
        </ServicesProvider>
      );
    case RESTORE_VIEW:
      return (
        <ServicesProvider services={createServices()}>
          <RestoreWindow data={data as RestoreWindowData} onDone={done} onClose={() => done(null)} />
        </ServicesProvider>
      );
    default:
      return null;
  }
}
