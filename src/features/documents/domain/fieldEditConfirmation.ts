// The question asked before an inline edit is written (R82): which document and field, and the value
// before and after with its type.
import type { ConfirmRequest } from "../../../shared/domain/confirmation";
import type { TargetWhere } from "../../../shared/domain/documentTarget";
import { formatValue } from "../../shell/domain/bsonFormat";
import { BSON_TYPE_LABEL } from "../../shell/domain/bsonValue";
import type { FieldEdit } from "../../../shared/ui/documentActions";
import { fieldPath } from "./fieldUpdate";
import { inlineDisplayText, inlineTypeOf } from "./inlineEdit";

/** "Guardar el cambio" window: the collection over it, the `_id` and field, then before and after in a table. */
export function fieldEditRequest(where: TargetWhere, { doc, path, before, after }: FieldEdit): ConfirmRequest {
  const type = BSON_TYPE_LABEL[inlineTypeOf(before)];
  return {
    title: "Guardar el cambio",
    message: "Solo se escribe este campo del documento.",
    where,
    details: [
      { label: "Documento", value: formatValue(doc._id, "utc") },
      { label: "Campo", value: fieldPath(path) },
    ],
    // Before and after one under the other, so a trailing space or a changed digit lines up.
    table: {
      columns: ["Valor", "Tipo"],
      rows: [
        { label: "Antes", cells: [inlineDisplayText(before), type] },
        { label: "Después", cells: [inlineDisplayText(after), type] },
      ],
    },
    confirmLabel: "Guardar",
    safe: true,
  };
}
