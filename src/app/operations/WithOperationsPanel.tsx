import type { ReactNode } from "react";
import { OperationsPanel } from "./OperationsPanel";
import { useOperations } from "./useOperations";

/** The main area with the operations panel on its right while it is open. */
export function WithOperationsPanel({ children }: { children: ReactNode }) {
  const { panelOpen } = useOperations();
  return (
    <div className="with-ops">
      <div className="with-ops-main">{children}</div>
      {panelOpen && <OperationsPanel />}
    </div>
  );
}
