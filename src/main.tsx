import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ModalWindow } from "./app/ModalWindow";
import { OperationsProvider } from "./app/operations/useOperations";
import "./app/themes/loadThemes";
import { createServices, ServicesProvider } from "./app/services";
import { currentModalView } from "./shared/ui/modalWindow";
import { initTheme } from "./shared/ui/theme";
import { LogProvider } from "./shared/ui/useLog";
import { NotificationsProvider } from "./shared/ui/useNotifications";

// Before the first render, so no window flashes in the other theme.
initTheme();
const modal = currentModalView();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {modal ? (
      <ModalWindow view={modal} />
    ) : (
      <ServicesProvider services={createServices()}>
        <NotificationsProvider>
          <LogProvider>
            <OperationsProvider>
              <App />
            </OperationsProvider>
          </LogProvider>
        </NotificationsProvider>
      </ServicesProvider>
    )}
  </React.StrictMode>,
);
