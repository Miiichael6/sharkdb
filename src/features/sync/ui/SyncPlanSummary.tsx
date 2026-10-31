import { collectionsLabel } from "../../../shared/domain/jobs";
import type { Tag } from "../../connections/domain/connection";
import { TagBadge } from "../../connections/ui/TagBadge";
import type { PlanDatabase } from "../domain/syncPlan";

interface Props {
  plan: PlanDatabase[];
  sourceName: string;
  target: { name: string; tag: Tag };
}

const ACTION_LABELS: Record<PlanDatabase["action"], string> = { replace: "reemplaza", create: "nueva" };
/** Collections listed by name for a partial database; beyond this, only the count. */
const LISTED_COLLECTIONS = 4;

function databaseDetail(d: PlanDatabase): string {
  if (d.complete) return `completa · ${collectionsLabel(d.collections.length)}`;
  const names = d.collections.slice(0, LISTED_COLLECTIONS).join(", ");
  const more = d.collections.length - LISTED_COLLECTIONS;
  return more > 0 ? `${names} y ${more} más` : names;
}

/** "Se va a MODIFICAR…": the destination and what happens to each of its databases (D7). */
export function SyncPlanSummary({ plan, sourceName, target }: Props) {
  return (
    <div className="sync-plan">
      <div className="sync-plan-title">
        <span>Se va a MODIFICAR</span>
        <TagBadge tag={target.tag} />
        <b>{target.name}</b>
      </div>
      <p className="muted small">con el contenido de {sourceName}; cada base de datos va a la de su mismo nombre.</p>
      {plan.length ? (
        <ul className="sync-plan-steps">
          {plan.map((d) => (
            <li key={d.db}>
              <span className={`sync-action ${d.action}`}>{ACTION_LABELS[d.action]}</span>
              <b>{d.db}</b>
              <span className="muted small grow ellipsis">{databaseDetail(d)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sync-plan-empty">Elige al menos una base de datos o colección</p>
      )}
      <p className="muted small">Las colecciones del destino que no elijas se conservan sin tocar.</p>
    </div>
  );
}
