import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ModalWindow } from "./app/ModalWindow";
import { OperationsProvider } from "./app/operations/useOperations";
import { RightSidebarProvider } from "./app/rightSidebar/useRightSidebar";
import "./app/themes/loadThemes";
import { createServices, ServicesProvider } from "./app/services";
import { currentModalView } from "./shared/ui/modalWindow";
import { moveRenamedStorage } from "./shared/ui/renamedStorage";
import { initTheme } from "./shared/ui/theme";
import { LogProvider } from "./shared/ui/useLog";
import { NotificationsProvider } from "./shared/ui/useNotifications";

// Before the first render, so no window flashes in the other theme.
moveRenamedStorage();
initTheme();
const modal = currentModalView();
// The main window follows the saved preferences from the start; a modal reads them if it needs them.
const services = modal ? null : createServices();
void services?.settings.start();
void services?.updates.checkOnStartup();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {modal ? (
      <ModalWindow view={modal} />
    ) : (
      services && (
        <ServicesProvider services={services}>
          <NotificationsProvider>
            <LogProvider>
              <RightSidebarProvider>
                <OperationsProvider>
                  <App />
                </OperationsProvider>
              </RightSidebarProvider>
            </LogProvider>
          </NotificationsProvider>
        </ServicesProvider>
      )
    )}
  </React.StrictMode>,
);
