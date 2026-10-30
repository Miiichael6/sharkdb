// Composition root: the only place that knows which adapters back each port.
import { createContext, useContext, type ReactNode } from "react";
import { createConnectionService, type ConnectionService } from "../features/connections/application/connectionService";
import { tauriConnectionStore } from "../features/connections/infrastructure/tauriConnectionStore";
import { tauriFilePicker } from "../features/connections/infrastructure/tauriFilePicker";
import { tauriSessionGateway } from "../features/connections/infrastructure/tauriSessionGateway";
import { createDocumentService, type DocumentService } from "../features/documents/application/documentService";
import { createCommandDocumentStore } from "../features/documents/infrastructure/commandDocumentStore";
import { tauriDocumentParser } from "../features/documents/infrastructure/tauriDocumentParser";
import { createExplorerService, type ExplorerService } from "../features/explorer/application/explorerService";
import { createCommandMongoAdmin } from "../features/explorer/infrastructure/commandMongoAdmin";
import { createHistoryService, type HistoryService } from "../features/shell/application/historyService";
import { createSchemaService, type SchemaService } from "../features/shell/application/schemaService";
import { createScriptFileService, type ScriptFileService } from "../features/shell/application/scriptFileService";
import { createShellService, type ShellService } from "../features/shell/application/shellService";
import { createCommandSchemaSource } from "../features/shell/infrastructure/commandSchemaSource";
import { tauriHistoryStore } from "../features/shell/infrastructure/tauriHistoryStore";
import { tauriScriptFiles } from "../features/shell/infrastructure/tauriScriptFiles";
import { tauriShellGateway } from "../features/shell/infrastructure/tauriShellGateway";
import { createTerminalService, type TerminalService } from "../features/workspace/application/terminalService";
import { tauriTerminalGateway } from "../features/workspace/infrastructure/tauriTerminalGateway";
import { tauriCommandRunner } from "../shared/infrastructure/commandRunner";

export interface Services {
  connections: ConnectionService;
  explorer: ExplorerService;
  shell: ShellService;
  history: HistoryService;
  schema: SchemaService;
  scriptFiles: ScriptFileService;
  documents: DocumentService;
  terminal: TerminalService;
}

export function createServices(): Services {
  return {
    connections: createConnectionService(tauriConnectionStore, tauriSessionGateway, tauriFilePicker),
    explorer: createExplorerService(createCommandMongoAdmin(tauriCommandRunner)),
    shell: createShellService(tauriShellGateway),
    history: createHistoryService(tauriHistoryStore),
    schema: createSchemaService(createCommandSchemaSource(tauriCommandRunner)),
    scriptFiles: createScriptFileService(tauriScriptFiles),
    documents: createDocumentService(tauriDocumentParser, createCommandDocumentStore(tauriCommandRunner)),
    terminal: createTerminalService(tauriTerminalGateway),
  };
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("useServices must be used inside <ServicesProvider>");
  return services;
}
