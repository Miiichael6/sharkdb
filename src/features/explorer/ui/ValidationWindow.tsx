import { useState, type ReactNode } from "react";
import { useServices } from "../../../app/services";
import type { TargetWhere } from "../../../shared/domain/documentTarget";
import { SAFE_MODE_ERROR } from "../../connections/domain/safeMode";
import { WhereBar } from "../../connections/ui/WhereBar";
import { CodeEditor } from "../../../shared/ui/CodeEditor";
import { Spinner } from "../../../shared/ui/common";
import { confirmInWindow } from "../../../shared/ui/confirmInWindow";
import { useEscapeDiscard } from "../../../shared/ui/useEscapeDiscard";
import { CycleButton, type CycleOption, type CycleTone } from "../../../shared/ui/CycleButton";
import type { CollectionRef } from "../domain/copySpec";
import type { Doc } from "../domain/mongo";
import {
  removeValidationRequest,
  VALIDATION_LEVELS,
  validationActions,
  type CollectionValidation,
  type ExtraFields,
  type ValidationAction,
  type ValidationLevel,
  type ValidationSettings,
} from "../domain/validation";
import { useSubmit } from "./useSubmit";

export const VALIDATION_VIEW = "validation";

/** What the opener passes to the validation window. */
export interface ValidationWindowData {
  collection: CollectionRef;
  /** Connection, database and collection, shown over the editor. */
  where: TargetWhere;
  initial: CollectionValidation;
  /** Safe mode: the validation can be read but not changed. */
  readOnly: boolean;
}

/** What the window hands back once it changed the server's validation. */
export interface ValidationWindowResult {
  removed: boolean;
}

const LEVEL_TONES: Record<ValidationLevel, CycleTone> = { off: "green", moderate: "amber", strict: "red" };
const ACTION_TONES: Record<ValidationAction, CycleTone> = { error: "red", warn: "amber", errorAndLog: "red" };
const withTones = <T extends string>(values: T[], tones: Record<T, CycleTone>): CycleOption<T>[] =>
  values.map((value) => ({ value, tone: tones[value] }));

const LEVELS = withTones(VALIDATION_LEVELS, LEVEL_TONES);
const EXTRA_FIELDS: CycleOption<ExtraFields>[] = [
  { value: "rechazar", tone: "red" },
  { value: "permitir", tone: "green" },
];

const LEVEL_HINTS: Record<ValidationLevel, string> = {
  off: "off: no valida nada; el esquema queda guardado",
  strict: "strict: valida todo insert y update",
  moderate: "moderate: los documentos viejos que ya no cumplen se pueden seguir editando",
};
const ACTION_HINTS: Record<ValidationAction, string> = {
  error: "error: rechaza el documento que no cumple",
  warn: "warn: lo guarda igual y lo anota en el log del servidor",
  errorAndLog: "errorAndLog: lo rechaza y además lo anota en el log del servidor",
};
const EXTRA_FIELD_HINTS: Record<ExtraFields, string> = {
  rechazar: "rechazar: en la raíz solo se admiten los campos del esquema (y _id)",
  permitir: "permitir: en la raíz se admiten campos que el esquema no lista",
};

const pretty = (rule: Doc | null) => (rule ? JSON.stringify(rule, null, 2) : "");

/**
 * "Validación…" of a collection: its `$jsonSchema` (or whole validator), level, action and extra
 * fields. Saves through the services itself, so a failed save keeps the window open with the error.
 */
export function ValidationWindow({
  data,
  onDone,
}: {
  data: ValidationWindowData;
  onDone: (result: ValidationWindowResult | null) => void;
}) {
  const { documents, explorer } = useServices();
  const { collection, where, initial, readOnly } = data;
  const [text, setText] = useState(() => pretty(initial.rule));
  const [settings, setSettings] = useState<ValidationSettings>(initial);
  const actions = withTones(validationActions(initial.action), ACTION_TONES);
  const change = (patch: Partial<ValidationSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const close = () => onDone(null);

  const dirty =
    text !== pretty(initial.rule) ||
    settings.level !== initial.level ||
    settings.action !== initial.action ||
    settings.extraFields !== initial.extraFields;
  useEscapeDiscard(!readOnly && dirty, "La validación", close);

  /** The editor's text as a document; shell syntax (unquoted keys, trailing commas…) is accepted. */
  const parsedRule = async (): Promise<Doc> => {
    if (!text.trim()) return {};
    const { document, error } = await documents.parse(text);
    if (error) throw error.line ? `Línea ${error.line}: ${error.message}` : error.message;
    return document!;
  };

  const save = useSubmit(async () => {
    await explorer.saveValidation(collection, await parsedRule(), initial.wholeValidator, settings);
    onDone({ removed: false });
  });
  const remove = useSubmit(async () => {
    if (!(await confirmInWindow(removeValidationRequest(where)))) return;
    await explorer.removeValidation(collection);
    onDone({ removed: true });
  });
  const busy = save.busy || remove.busy;
  const error = save.error || remove.error;

  return (
    <div className="document-window validation-window">
      <WhereBar where={where} className="document-where" />
      <p className="muted small validation-note">
        {initial.wholeValidator
          ? "El validador tiene más que un $jsonSchema (puesto desde un script): se edita y se guarda entero."
          : "$jsonSchema de la colección. Vacío si no tiene validación."}
      </p>
      <CodeEditor className="validation-editor" value={text} onChange={setText} autoFocus />

      <div className="validation-options">
        <ValidationOption title="Nivel" hint={LEVEL_HINTS[settings.level]}>
          <CycleButton label="Nivel" options={LEVELS} value={settings.level} onChange={(level) => change({ level })} />
        </ValidationOption>
        <ValidationOption title="Acción" hint={ACTION_HINTS[settings.action]}>
          <CycleButton label="Acción" options={actions} value={settings.action} onChange={(action) => change({ action })} />
        </ValidationOption>
        <ValidationOption title="Campos extra" hint={EXTRA_FIELD_HINTS[settings.extraFields]}>
          <CycleButton
            label="Campos extra"
            options={EXTRA_FIELDS}
            value={settings.extraFields}
            onChange={(extraFields) => change({ extraFields })}
          />
        </ValidationOption>
      </div>

      {readOnly && <p className="muted small">{SAFE_MODE_ERROR}: la validación no se puede cambiar.</p>}
      {error && <p className="test error">{error}</p>}
      <div className="modal-footer">
        <button
          type="button"
          className="danger"
          onClick={() => remove.submit()}
          disabled={readOnly || busy || !initial.rule}
          title={readOnly ? SAFE_MODE_ERROR : undefined}
        >
          {remove.busy && <Spinner />} Quitar validación
        </button>
        <span className="spacer" />
        <button type="button" onClick={close}>
          Cancelar
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => save.submit()}
          disabled={readOnly || busy}
          title={readOnly ? SAFE_MODE_ERROR : undefined}
        >
          {save.busy && <Spinner />} Guardar
        </button>
      </div>
    </div>
  );
}

function ValidationOption({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="validation-option">
      <span className="muted small">{title}</span>
      {children}
      <span className="muted small">{hint}</span>
    </div>
  );
}
