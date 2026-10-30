// Composition root: the only place that knows which adapters back each port.
import { createContext, useContext, type ReactNode } from "react";
import { createConnectionService, type ConnectionService } from "../features/connections/application/connectionService";
import { tauriConnectionStore } from "../features/connections/infrastructure/tauriConnectionStore";
import { tauriSessionGateway } from "../features/connections/infrastructure/tauriSessionGateway";
import { createExplorerService, type ExplorerService } from "../features/explorer/application/explorerService";
import { createCommandMongoAdmin } from "../features/explorer/infrastructure/commandMongoAdmin";
import { tauriCommandRunner } from "../features/explorer/infrastructure/tauriCommandRunner";

export interface Services {
  connections: ConnectionService;
  explorer: ExplorerService;
}

export function createServices(): Services {
  return {
    connections: createConnectionService(tauriConnectionStore, tauriSessionGateway),
    explorer: createExplorerService(createCommandMongoAdmin(tauriCommandRunner)),
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
