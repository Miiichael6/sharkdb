import type { PlanDatabase } from "../domain/databasePlan";

/** Asks to choose something while nothing is; what happens to each database is shown in the confirmation window. */
export function EmptySelectionHint({ plan }: { plan: PlanDatabase[] }) {
  if (plan.length) return null;
  return <p className="selection-empty">Elige al menos una base de datos o colección</p>;
}
