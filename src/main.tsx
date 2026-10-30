import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { createServices, ServicesProvider } from "./app/services";
import { DocumentActionsProvider } from "./features/documents/ui/DocumentActionsProvider";
import { LogProvider } from "./shared/ui/useLog";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ServicesProvider services={createServices()}>
      <LogProvider>
        <DocumentActionsProvider>
          <App />
        </DocumentActionsProvider>
      </LogProvider>
    </ServicesProvider>
  </React.StrictMode>,
);
