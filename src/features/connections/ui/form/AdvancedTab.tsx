import { READ_PREFERENCES, type ReadPreference } from "../../domain/advancedOptions";
import type { MongoConnection } from "../../domain/connection";
import { Row } from "./Row";
import { UriModeNote } from "./UriModeNote";
import type { SetField } from "./useConnectionForm";

interface Props {
  conn: MongoConnection;
  set: SetField;
}

const MS_PER_SECOND = 1000;

export function AdvancedTab({ conn, set }: Props) {
  if (conn.mode === "uri") return <UriModeNote example="replicaSet=rs0&readPreference=secondary" />;

  return (
    <>
      <Row label="Replica set">
        <input
          value={conn.replicaSet}
          onChange={(e) => set("replicaSet", e.target.value)}
          placeholder="Opcional, p. ej. rs0"
          spellCheck={false}
        />
      </Row>
      <Row label="Read preference">
        <select value={conn.readPreference} onChange={(e) => set("readPreference", e.target.value as ReadPreference)}>
          {READ_PREFERENCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Timeout (s)">
        <input
          className="port"
          type="number"
          min={1}
          value={conn.connectTimeoutMs / MS_PER_SECOND || ""}
          onChange={(e) => set("connectTimeoutMs", Math.round(Number(e.target.value) * MS_PER_SECOND))}
        />
      </Row>
      <Row label="Opciones">
        <input
          className="mono"
          value={conn.options}
          onChange={(e) => set("options", e.target.value)}
          placeholder="retryWrites=true&w=majority"
          spellCheck={false}
        />
      </Row>
    </>
  );
}
