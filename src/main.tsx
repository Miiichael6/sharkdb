import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./app/App";
import { ModalWindow } from "./app/ModalWindow";
import { OperationsProvider } from "./app/operations/useOperations";
import { RightSidebarProvider } from "./app/rightSidebar/useRightSidebar";
import "./app/themes/loadThemes";
import { createServices, ServicesProvider } from "./app/services";
import { showWhatsNewOnUpdate } from "./features/whatsNew/ui/whatsNewViews";
import { currentModalView } from "./shared/ui/modalWindow";
import { moveRenamedStorage } from "./shared/ui/renamedStorage";
import { initTheme } from "./shared/ui/theme";
import { LogProvider } from "./shared/ui/useLog";
import { NotificationsProvider } from "./shared/ui/useNotifications";

/** Lets the main window settle before "Novedades" opens centred over it. */
const WHATS_NEW_DELAY_MS = 600;

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

// The main window opens hidden (tauri.conf.json): shown once the first frame is drawn, so it never
// flashes blank. A modal shows itself when its view is ready (`showModalWindow`).
if (!modal) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      void getCurrentWindow()
        .show()
        .catch(() => {})
        // "Novedades" over the window once it's on screen, the first start of each version.
        .then(() => setTimeout(() => void showWhatsNewOnUpdate(), WHATS_NEW_DELAY_MS)),
    ),
  );
}
