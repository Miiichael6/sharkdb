import { useState, type FormEvent } from "react";
import { errorMessage } from "../../../shared/errors";
import { Modal, Spinner } from "../../../shared/ui/common";
import { defaultIndexName, editedSpec, parseJsonObject } from "../domain/indexSpec";
import type { IndexSpec } from "../domain/mongo";
import { Field } from "../../../shared/ui/Field";
import { useSubmit } from "./useSubmit";

export interface PromptField {
  name: string;
  label: string;
  placeholder?: string;
  initial?: string;
}

export function PromptDialog({
  title,
  fields,
  confirmLabel,
  note,
  onSubmit,
  onClose,
}: {
  title: string;
  fields: PromptField[];
  confirmLabel: string;
  note?: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.initial ?? ""])),
  );
  const filled = fields.every((f) => values[f.name].trim());
  const { busy, error, submit } = useSubmit(() =>
    onSubmit(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]))),
  );

  return (
    <Modal onClose={onClose} className="dialog">
      <h3>{title}</h3>
      <form onSubmit={(e) => filled && submit(e)}>
        {fields.map((f, i) => (
          <label key={f.name} className="stack">
            <span className="muted">{f.label}</span>
            <input
              value={values[f.name]}
              placeholder={f.placeholder}
              autoFocus={i === 0}
              spellCheck={false}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            />
          </label>
        ))}
        {note && <p className="muted small">{note}</p>}
        {error && <p className="test error">{error}</p>}
        <div className="modal-footer">
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={!filled || busy}>
            {busy && <Spinner />} {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type IndexTab = "basic" | "advanced" | "text";

/** Robo 3T's "Index Properties": Basic / Advanced / Text Search tabs. */
export function IndexDialog({
  collection,
  initial,
  onSubmit,
  onClose,
}: {
  collection: string;
  initial?: IndexSpec;
  onSubmit: (spec: IndexSpec) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<IndexTab>("basic");
  const [name, setName] = useState(initial?.name ?? "");
  const [keys, setKeys] = useState(initial ? pretty(initial.key) : '{\n  "campo": 1\n}');
  const [unique, setUnique] = useState(!!initial?.unique);
  const [sparse, setSparse] = useState(!!initial?.sparse);
  const [background, setBackground] = useState(!!initial?.background);
  const [ttl, setTtl] = useState(initial?.expireAfterSeconds?.toString() ?? "");
  const [partial, setPartial] = useState(initial?.partialFilterExpression ? pretty(initial.partialFilterExpression) : "");
  const [language, setLanguage] = useState(initial?.default_language ?? "");
  const [languageOverride, setLanguageOverride] = useState(initial?.language_override ?? "");
  const [weights, setWeights] = useState(initial?.weights ? pretty(initial.weights) : "");

  const { busy, error, setError, submit } = useSubmit(() => onSubmit(buildSpec()));

  function buildSpec(): IndexSpec {
    const key = parseJsonObject(keys, "Claves");
    if (!Object.keys(key).length) throw "Claves: indica al menos un campo, p. ej. { \"campo\": 1 }";
    const spec: IndexSpec = { name: name.trim() || defaultIndexName(key), key };
    if (unique) spec.unique = true;
    if (sparse) spec.sparse = true;
    if (background) spec.background = true;
    if (ttl.trim()) spec.expireAfterSeconds = Number(ttl);
    if (partial.trim()) spec.partialFilterExpression = parseJsonObject(partial, "Filtro parcial");
    if (language.trim()) spec.default_language = language.trim();
    if (languageOverride.trim()) spec.language_override = languageOverride.trim();
    if (weights.trim()) spec.weights = parseJsonObject(weights, "Pesos de texto");
    return initial ? editedSpec(initial, spec) : spec;
  }

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    try {
      buildSpec();
    } catch (err) {
      setError(errorMessage(err));
      return;
    }
    submit();
  };

  const tabs: [IndexTab, string][] = [
    ["basic", "Básico"],
    ["advanced", "Avanzado"],
    ["text", "Búsqueda de texto"],
  ];

  return (
    <Modal onClose={onClose} className="dialog index-dialog">
      <h3>
        {initial ? "Editar índice" : "Añadir índice"} <span className="muted">· {collection}</span>
      </h3>
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSave}>
        <div className="tab-body">
          {tab === "basic" && (
            <>
              <Field label="Nombre">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Automático (campo_1)" spellCheck={false} autoFocus />
              </Field>
              <Field label="Claves (JSON)">
                <textarea className="mono" rows={6} value={keys} onChange={(e) => setKeys(e.target.value)} spellCheck={false} />
              </Field>
              <label className="check">
                <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} /> Único
              </label>
            </>
          )}
          {tab === "advanced" && (
            <>
              <label className="check">
                <input type="checkbox" checked={sparse} onChange={(e) => setSparse(e.target.checked)} /> Disperso (sparse)
              </label>
              <label className="check">
                <input type="checkbox" checked={background} onChange={(e) => setBackground(e.target.checked)} /> Crear en segundo plano
              </label>
              <Field label="Expirar tras (segundos, TTL)">
                <input
                  value={ttl}
                  inputMode="numeric"
                  placeholder="Sin expiración"
                  onChange={(e) => setTtl(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field label="Filtro parcial (JSON)">
                <textarea className="mono" rows={4} value={partial} onChange={(e) => setPartial(e.target.value)} placeholder='{ "activo": true }' spellCheck={false} />
              </Field>
            </>
          )}
          {tab === "text" && (
            <>
              <Field label="Idioma por defecto">
                <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="spanish" spellCheck={false} />
              </Field>
              <Field label="Campo de idioma (language override)">
                <input value={languageOverride} onChange={(e) => setLanguageOverride(e.target.value)} placeholder="language" spellCheck={false} />
              </Field>
              <Field label="Pesos de texto (JSON)">
                <textarea className="mono" rows={4} value={weights} onChange={(e) => setWeights(e.target.value)} placeholder='{ "titulo": 10, "cuerpo": 1 }' spellCheck={false} />
              </Field>
              <p className="muted small">Solo aplica si alguna clave es de tipo "text".</p>
            </>
          )}
        </div>

        {initial && (
          <p className="muted small">
            MongoDB no permite modificar un índice: se eliminará y se volverá a crear. Si la creación falla, se restaura
            el original.
          </p>
        )}
        {error && <p className="test error">{error}</p>}
        <div className="modal-footer">
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy && <Spinner />} Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

const pretty = (v: unknown) => JSON.stringify(v, null, 2);
