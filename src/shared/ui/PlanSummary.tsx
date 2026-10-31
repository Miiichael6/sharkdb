import { actionLabel, databaseDetail, type PlanDatabase } from "../domain/databasePlan";

interface Props {
  plan: PlanDatabase[];
}

/** Short summary of what happens to each chosen database; the next window asks to confirm it. */
export function PlanSummary({ plan }: Props) {
  if (!plan.length) return <p className="selection-empty">Elige al menos una base de datos o colección</p>;
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
