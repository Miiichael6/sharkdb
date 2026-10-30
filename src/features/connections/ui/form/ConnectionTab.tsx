import { COLORS, TAGS, buildUri, type ConnectMode, type MongoConnection, type Tag } from "../../domain/connection";
import { CheckRow } from "./CheckRow";
import { Row } from "./Row";
import type { SetField } from "./useConnectionForm";

interface Props {
  conn: MongoConnection;
  set: SetField;
  modeError: string;
  onSwitchMode: (mode: ConnectMode) => void;
}

const MODES: [ConnectMode, string][] = [
  ["fields", "Host y credenciales"],
  ["uri", "URI"],
];

/** Name, label colour and where the server is (host and port, or a full URI). */
export function ConnectionTab({ conn, set, modeError, onSwitchMode }: Props) {
  return (
    <>
      <Row label="Nombre">
        <input value={conn.name} onChange={(e) => set("name", e.target.value)} placeholder="Mi cluster" autoFocus />
      </Row>

      <div className="row">
        <span className="row-label">Etiqueta</span>
        <div className="row-field inline">
          <select aria-label="Etiqueta" value={conn.tag} onChange={(e) => set("tag", e.target.value as Tag)}>
            {TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="swatches" role="radiogroup" aria-label="Color">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                role="radio"
                aria-checked={conn.color === c}
                aria-label={c}
                className={`swatch ${conn.color === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => set("color", c)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="row">
        <span className="row-label">Conectar con</span>
        <div className="row-field">
          <div className="segmented" role="radiogroup" aria-label="Conectar con">
            {MODES.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={conn.mode === mode}
                className={conn.mode === mode ? "active" : ""}
                onClick={() => onSwitchMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {modeError && <p className="field-error">{modeError}</p>}

      {conn.mode === "uri" ? (
        <Row label="URI">
          <textarea
            className="mono"
            rows={3}
            spellCheck={false}
            value={conn.uri}
            onChange={(e) => set("uri", e.target.value)}
            placeholder="mongodb+srv://usuario:password@cluster0.example.mongodb.net/?retryWrites=true"
          />
        </Row>
      ) : (
        <>
          <Row label="Host">
            <input
              value={conn.host}
              onChange={(e) => set("host", e.target.value)}
              placeholder="localhost"
              spellCheck={false}
            />
          </Row>
          {!conn.srv && (
            <Row label="Puerto">
              <input
                className="port"
                type="number"
                min={1}
                max={65535}
                value={conn.port || ""}
                onChange={(e) => set("port", Number(e.target.value))}
              />
            </Row>
          )}
          <CheckRow checked={conn.srv} onChange={(v) => set("srv", v)}>
            Registro SRV <span className="muted">(mongodb+srv, p. ej. Atlas)</span>
          </CheckRow>
          <div className="row">
            <span className="row-label">URI</span>
            <code className="row-field uri-preview">{buildUri(conn, true)}</code>
          </div>
        </>
      )}
    </>
  );
}
