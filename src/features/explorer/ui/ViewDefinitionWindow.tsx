import type { TargetWhere } from "../../../shared/domain/documentTarget";
import { CodeEditor } from "../../../shared/ui/CodeEditor";
import { useEscapeDiscard } from "../../../shared/ui/useEscapeDiscard";
import { formatValue } from "../../shell/domain/bsonFormat";
import { WhereBar } from "../../connections/ui/WhereBar";

export const VIEW_DEFINITION_VIEW = "view-definition";

/** What the opener passes to the view definition window. */
export interface ViewDefinitionWindowData {
  /** Connection, database and view, shown over the definition. */
  where: TargetWhere;
  /** The view's `options` from `listCollections`: `viewOn` and `pipeline`. */
  options: unknown;
}

/** "Ver definición" of a view: its source collection and pipeline, read-only. */
export function ViewDefinitionWindow({ data, onDone }: { data: ViewDefinitionWindowData; onDone: () => void }) {
  useEscapeDiscard(false, "La definición", onDone);
  return (
    <div className="document-window">
      <WhereBar where={data.where} className="document-where" />
      <CodeEditor className="validation-editor" value={formatValue(data.options, "utc")} readOnly autoFocus />
      <div className="modal-footer">
        <span className="spacer" />
        <button type="button" className="primary" onClick={onDone}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
