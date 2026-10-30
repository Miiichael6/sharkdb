import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { createServices, ServicesProvider } from "./app/services";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ServicesProvider services={createServices()}>
      <App />
    </ServicesProvider>
  </React.StrictMode>,
);
