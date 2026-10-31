import { Spinner } from "../../../shared/ui/common";
import { Field } from "../../../shared/ui/Field";
import { NO_TARGET, type SyncConnection } from "../domain/syncPlan";

interface Props {
  options: Omit<SyncConnection, "tag">[];
  value: string;
  onChange: (id: string) => void;
  status: { connecting: boolean; error: string };
}

const CLOSED_HINT = " · se conectará";

function optionLabel(option: Omit<SyncConnection, "tag">) {
  if (option.blocked) return `${option.name} — ${option.blocked}`;
  return option.connected ? option.name : `${option.name}${CLOSED_HINT}`;
}

/** One end's connection: every registered one it can be; a closed one shows while it connects, or why it couldn't. */
export function SyncConnectionField({ options, value, onChange, status }: Props) {
  return (
    <Field label="Conexión">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {!value && <option value="">{NO_TARGET}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id} disabled={!!o.blocked}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
      {status.connecting && (
        <span className="sync-connecting muted small">
          <Spinner /> Conectando…
        </span>
      )}
      {status.error && <span className="test error small">{status.error}</span>}
    </Field>
  );
}
