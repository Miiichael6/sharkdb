import { Spinner } from "../../../shared/ui/common";
import { Field } from "../../../shared/ui/Field";
import { NO_TARGET, type ConnectionOption } from "../domain/endpoints";
import type { ConnectionStatus } from "./useConnectionsOnDemand";

interface Props {
  options: Omit<ConnectionOption, "tag">[];
  value: string;
  onChange: (id: string) => void;
  status: ConnectionStatus;
}

const CLOSED_HINT = " · se conectará";

function optionLabel(option: Omit<ConnectionOption, "tag">) {
  if (option.blocked) return `${option.name} — ${option.blocked}`;
  return option.connected ? option.name : `${option.name}${CLOSED_HINT}`;
}

/**
 * One end's connection: every registered one it can be; a closed one shows while it connects, or why it
 * couldn't, and a chosen one that can't be written to says why.
 */
export function ConnectionField({ options, value, onChange, status }: Props) {
  const blocked = options.find((o) => o.id === value)?.blocked;
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
        <span className="selection-connecting muted small">
          <Spinner /> Conectando…
        </span>
      )}
      {status.error && <span className="test error small">{status.error}</span>}
      {blocked && <span className="test error small">{blocked}</span>}
    </Field>
  );
}
