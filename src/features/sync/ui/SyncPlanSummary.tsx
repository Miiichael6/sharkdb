import { actionLabel, databaseDetail, type PlanDatabase } from "../domain/syncPlan";

interface Props {
  plan: PlanDatabase[];
}

/** Short summary of what the sync does to each database of the destination; the next window asks to confirm it. */
export function SyncPlanSummary({ plan }: Props) {
  if (!plan.length) return <p className="sync-plan-empty">Elige al menos una base de datos o colección</p>;
  return (
    <ul className="plan-steps">
      {plan.map((d) => (
        <li key={d.db}>
          <span className={`plan-action ${d.action}`}>{actionLabel(d)}</span>
          <b>{d.db}</b>
          <span className="muted small grow ellipsis">{databaseDetail(d)}</span>
        </li>
      ))}
    </ul>
  );
}
