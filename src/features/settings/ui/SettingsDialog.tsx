import { useEffect, useState } from "react";
import { useServices } from "../../../app/services";
import { errorMessage } from "../../../shared/errors";
import { Field } from "../../../shared/ui/Field";
import { SegmentedControl } from "../../../shared/ui/SegmentedControl";
import type { DateZone } from "../../shell/domain/bsonFormat";
import { VIEW_MODES } from "../../shell/domain/resultView";
import { DEFAULT_SETTINGS, PAGE_SIZE_RANGE, TIMEOUT_RANGE, type Settings } from "../domain/settings";

const VIEW_SEGMENTS = VIEW_MODES.map((v) => ({ id: v.mode, label: v.label }));
const ZONE_SEGMENTS: { id: DateZone; label: string }[] = [
  { id: "utc", label: "UTC" },
  { id: "local", label: "Local" },
];

/**
 * The "Preferencias" window: how new results open and the limits of each run. Guardar saves them and
 * every window follows; Cancelar or Escape leave them as they were.
 */
export function SettingsDialog({ onDone }: { onDone: (result: null) => void }) {
  const { settings } = useServices();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [error, setError] = useState("");

  // If the saved file can't be read, the window still opens, with the defaults and the reason.
  useEffect(() => {
    settings.load().then(setDraft, (e) => {
      setDraft(DEFAULT_SETTINGS);
      setError(`No se pudieron leer las preferencias: ${errorMessage(e)}`);
    });
  }, [settings]);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  if (!draft) return null;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft({ ...draft, [key]: value });
  const save = async () => {
    try {
      await settings.save(draft);
      onDone(null);
    } catch (e) {
      setError(`No se pudieron guardar las preferencias: ${errorMessage(e)}`);
    }
  };

  return (
    <div className="settings-dialog">
      <div className="settings-dialog-body">
        <Field label="Vista de los resultados">
          <SegmentedControl segments={VIEW_SEGMENTS} value={draft.defaultView} onChange={(v) => set("defaultView", v)} label="Vista" />
        </Field>
        <Field label="Fechas">
          <SegmentedControl segments={ZONE_SEGMENTS} value={draft.dateZone} onChange={(z) => set("dateZone", z)} label="Fechas" />
        </Field>
        <Field label="Documentos por página">
          <input
            type="number"
            min={PAGE_SIZE_RANGE.min}
            max={PAGE_SIZE_RANGE.max}
            value={draft.pageSize || ""}
            onChange={(e) => set("pageSize", Number(e.target.value))}
          />
        </Field>
        <Field label="Tiempo máximo por script (s)">
          <input
            type="number"
            min={TIMEOUT_RANGE.min}
            max={TIMEOUT_RANGE.max}
            value={draft.timeoutSeconds || ""}
            onChange={(e) => set("timeoutSeconds", Number(e.target.value))}
          />
        </Field>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button onClick={() => setDraft(DEFAULT_SETTINGS)}>Restablecer</button>
        <span className="spacer" />
        <button onClick={() => onDone(null)}>Cancelar</button>
        <button className="primary" onClick={() => void save()}>
          Guardar
        </button>
      </div>
    </div>
  );
}
