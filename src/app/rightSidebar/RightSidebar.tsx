import { OperationsPanel } from "../operations/OperationsPanel";
import { useRightSidebar, type SidebarTab } from "./useRightSidebar";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "operations", label: "Operaciones" },
];

/** The right sidebar: one tab at a time; closing it stops nothing. */
export function RightSidebar({ tab, width }: { tab: SidebarTab; width: number }) {
  const { show, close } = useRightSidebar();
  return (
    <aside className="right-sidebar" aria-label="Panel derecho" style={{ width }}>
      <header className="rs-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} className="rs-tab" onClick={() => show(t.id)}>
            {t.label}
          </button>
        ))}
        <button type="button" className="ghost small rs-close" onClick={close} aria-label="Cerrar el panel derecho" title="Cerrar">
          ×
        </button>
      </header>
      {tab === "operations" && <OperationsPanel />}
    </aside>
  );
}
