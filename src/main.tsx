import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ModalWindow } from "./app/ModalWindow";
import { createServices, ServicesProvider } from "./app/services";
import { DocumentActionsProvider } from "./features/documents/ui/DocumentActionsProvider";
import { currentModalView } from "./shared/ui/modalWindow";
import { LogProvider } from "./shared/ui/useLog";
import { NotificationsProvider } from "./shared/ui/useNotifications";

const modal = currentModalView();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {modal ? (
      <ModalWindow view={modal} />
    ) : (
      <ServicesProvider services={createServices()}>
        <LogProvider>
          <NotificationsProvider>
            <DocumentActionsProvider>
              <App />
            </DocumentActionsProvider>
          </NotificationsProvider>
        </LogProvider>
      </ServicesProvider>
    )}
  </React.StrictMode>,
);
