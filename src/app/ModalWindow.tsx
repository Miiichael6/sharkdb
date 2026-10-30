// What a window opened with `openModalWindow` renders instead of the app.
import { useCallback, useEffect, useState } from "react";
import {
  DOCUMENT_EDITOR_VIEW,
  DocumentEditorWindow,
  type DocumentEditorData,
} from "../features/documents/ui/DocumentEditorWindow";
import { OpenDatabaseDialog, type DatabaseChoice } from "../features/workspace/ui/OpenDatabaseDialog";
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
    case OPEN_DATABASE_VIEW:
      return <OpenDatabaseDialog databases={data as DatabaseChoice[]} onDone={done} />;
    case DOCUMENT_EDITOR_VIEW:
      return (
        <ServicesProvider services={createServices()}>
          <DocumentEditorWindow data={data as DocumentEditorData} onDone={done} />
        </ServicesProvider>
      );
    default:
      return null;
  }
}
