// What a window opened with `openModalWindow` renders instead of the app.
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import { WhereBar } from "../features/connections/ui/WhereBar";
import {
  DOCUMENT_EDITOR_VIEW,
  DocumentEditorWindow,
  type DocumentEditorData,
} from "../features/documents/ui/DocumentEditorWindow";
import { VALIDATION_VIEW, ValidationWindow, type ValidationWindowData } from "../features/explorer/ui/ValidationWindow";
import { SyncSelectWindow } from "../features/sync/ui/SyncSelectWindow";
import { SYNC_VIEW, type SyncWindowData } from "../features/sync/ui/syncViews";
import type { OpenDatabaseData, OpenDatabaseRequest } from "../features/workspace/domain/databaseChoice";
import { OpenDatabaseDialog } from "../features/workspace/ui/OpenDatabaseDialog";
import { ThemeDialog } from "../features/workspace/ui/ThemeDialog";
import type { ConfirmRequest, DangerConfirmRequest } from "../shared/domain/confirmation";
import type { DeleteConfirmRequest } from "../shared/domain/destructiveActions";
import type { ThemeSelection } from "../shared/domain/themes";
import { CONFIRM_VIEW, DANGER_CONFIRM_VIEW, DELETE_CONFIRM_VIEW } from "../shared/ui/confirmInWindow";
import { ConfirmWindow } from "../shared/ui/ConfirmWindow";
import { DangerConfirmWindow } from "../shared/ui/DangerConfirmWindow";
import { DeleteConfirmWindow } from "../shared/ui/DeleteConfirmWindow";
import { ModalTitleBar } from "../shared/ui/ModalTitleBar";
import {
  askOpener,
  currentModalClosable,
  currentModalMaximizable,
  currentModalTitle,
  finishModalWindow,
  receiveModalData,
  releaseOpener,
  showModalWindow,
} from "../shared/ui/modalWindow";
import { THEME_VIEW } from "../shared/ui/themeWindow";
import { createServices, ServicesProvider } from "./services";
import "./App.css";

export const OPEN_DATABASE_VIEW = "open-database";

/** If the data never comes, the hidden window shows anyway so it can be closed (the opener stays disabled). */
const SHOW_ANYWAY_MS = 2000;

/** The modal's own title bar over its view; the window opens hidden and shows once the view is drawn. */
export function ModalWindow({ view }: { view: string }) {
  const [data, setData] = useState<unknown>();
  useEffect(() => receiveModalData(view, (d) => setData(() => d)), [view]);
  // Closed from its title bar or with Alt+F4: the opener is enabled again before the window is destroyed.
  useEffect(() => {
    const stop = getCurrentWindow().onCloseRequested(() => releaseOpener());
    return () => void stop.then((unlisten) => unlisten());
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void showModalWindow(), SHOW_ANYWAY_MS);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (data === undefined) return;
    // After the browser has painted the view, so the window appears already laid out.
    let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(() => void showModalWindow())));
    return () => cancelAnimationFrame(frame);
  }, [data]);
  const done = useCallback((result: unknown) => void finishModalWindow(view, result), [view]);

  return (
    <div className="modal-window">
      <ModalTitleBar title={currentModalTitle()} closable={currentModalClosable()} maximizable={currentModalMaximizable()} />
      <div className="modal-window-body">{data !== undefined && <ModalView view={view} data={data} done={done} />}</div>
    </div>
  );
}

function ModalView({ view, data, done }: { view: string; data: unknown; done: (result: unknown) => void }) {
  switch (view) {
    case CONFIRM_VIEW: {
      const request = data as ConfirmRequest;
      const where = request.where && <WhereBar where={request.where} className="confirm-where" />;
      return <ConfirmWindow request={request} where={where} onDone={done} />;
    }
    case OPEN_CONNECTION_VIEW:
      return <OpenConnectionDialog data={data as OpenConnectionData} onDone={done} />;
    case OPEN_DATABASE_VIEW: {
      // Stars and new databases are saved by the opener, which owns the connections and sessions.
      const ask = (request: OpenDatabaseRequest) => askOpener<void>(OPEN_DATABASE_VIEW, request);
      return (
        <OpenDatabaseDialog
          data={data as OpenDatabaseData}
          onFavorites={(favorites) => ask({ kind: "favorites", favorites })}
          onCreate={(db, coll) => ask({ kind: "create", db, coll })}
          onDone={done}
        />
      );
    }
    case DOCUMENT_EDITOR_VIEW:
      return (
        <ServicesProvider services={createServices()}>
          <DocumentEditorWindow data={data as DocumentEditorData} onDone={done} />
        </ServicesProvider>
      );
    case DELETE_CONFIRM_VIEW: {
      const request = data as DeleteConfirmRequest;
      const where = <WhereBar where={request.where} className="delete-where" />;
      return <DeleteConfirmWindow request={request} where={where} onDone={done} />;
    }
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
    case THEME_VIEW:
      return <ThemeDialog data={data as ThemeSelection} onDone={done} />;
    case VALIDATION_VIEW:
      return (
        <ServicesProvider services={createServices()}>
          <ValidationWindow data={data as ValidationWindowData} onDone={done} />
        </ServicesProvider>
      );
    default:
      return null;
  }
}
