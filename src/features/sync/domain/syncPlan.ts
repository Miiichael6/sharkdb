// Sync between environments (R30, D7): replaces whole databases or some of their collections in
// another connection, each database in the one with its same name.
import type { DangerConfirmRequest } from "../../../shared/domain/confirmation";
import { databasesLabel, planItems, planSelections, type PlanDatabase } from "../../../shared/domain/databasePlan";
import { collectionsLabel, totalDocuments, type CollectionResult } from "../../../shared/domain/jobs";
import { requireCollections, type DatabaseSelection } from "../../../shared/domain/selection";

export interface SyncRequest {
  sourceSid: string;
  targetSid: string;
  databases: DatabaseSelection[];
}

export const TARGET_REQUIRED = "Elige la conexión de destino";
export const TARGET_IS_SOURCE = "El destino no puede ser la conexión de origen";

export const syncRequest = (sourceSid: string, targetSid: string, plan: PlanDatabase[]): SyncRequest => ({
  sourceSid,
  targetSid,
  databases: planSelections(plan),
});

/** Checks a sync. Throws the message to show. */
export function validateSync(r: SyncRequest): SyncRequest {
  if (!r.targetSid) throw TARGET_REQUIRED;
  if (r.sourceSid === r.targetSid) throw TARGET_IS_SOURCE;
  requireCollections(r.databases);
  return r;
}

/** The second window: what the destination loses, before typing the confirmation word (D9). */
export const syncConfirmation = (
  plan: PlanDatabase[],
  source: string,
  target: { name: string; tag?: string },
  blocked?: string,
): DangerConfirmRequest => ({
  title: "Confirmar sincronización",
  target,
  intro: `con el contenido de ${source}; cada base de datos va a la de su mismo nombre.`,
  items: planItems(plan),
  note: "Las colecciones del destino que no elegiste se conservan sin tocar.",
  confirmLabel: "Sincronizar",
  blocked,
});

export const syncSummary = (target: string, databases: number, results: CollectionResult[]) =>
  `Sincronizado ${target}: ${databasesLabel(databases)}, ${collectionsLabel(results.length)}, ${totalDocuments(results).toLocaleString()} documentos`;
