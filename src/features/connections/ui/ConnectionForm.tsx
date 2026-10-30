import { useState, type ReactNode } from "react";
import { useServices } from "../../../app/services";
import { errorMessage } from "../../../shared/errors";
import { Avatar, Modal, Spinner } from "../../../shared/ui/common";
import {
  COLORS,
  TAGS,
  buildUri,
  fieldsFromUri,
  type ConnectMode,
  type MongoConnection,
  type Tag,
} from "../domain/connection";
import type { ServerInfo } from "../domain/session";

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; info: ServerInfo }
  | { status: "error"; message: string };

interface Props {
  initial: MongoConnection;
  isNew: boolean;
  onSave: (c: MongoConnection) => void;
  onConnect: (c: MongoConnection) => void;
  onClose: () => void;
}

export function ConnectionForm({ initial, isNew, onSave, onConnect, onClose }: Props) {
  const { connections } = useServices();
  const [conn, setConn] = useState(initial);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [showPassword, setShowPassword] = useState(false);
  const [modeError, setModeError] = useState("");

  const set = <K extends keyof MongoConnection>(key: K, value: MongoConnection[K]) => {
    setConn((c) => ({ ...c, [key]: value }));
    setTest({ status: "idle" });
  };

  const switchMode = (mode: ConnectMode) => {
    if (mode === conn.mode) return;
    setModeError("");
    if (mode === "uri") {
      setConn((c) => ({ ...c, mode, uri: buildUri(c) }));
      return;
    }
    const fromUri = fieldsFromUri(conn, conn.uri);
    if (fromUri) setConn(fromUri);
    else setModeError("La URI tiene varios hosts o no es válida; edítala en modo URI.");
  };

  const canSubmit = conn.mode === "uri" ? /^mongodb(\+srv)?:\/\/.+/.test(conn.uri.trim()) : !!conn.host.trim();

  const runTest = async () => {
    setTest({ status: "testing" });
    try {
      setTest({ status: "ok", info: await connections.test(conn) });
    } catch (e) {
      setTest({ status: "error", message: errorMessage(e) });
    }
  };

  return (
    <Modal onClose={onClose} className="conn-form">
      <header className="form-header">
        <Avatar color={conn.color} size={40} />
        <div>
          <h2>{isNew ? "Nueva conexión" : "Editar conexión"}</h2>
          <span className="muted">MongoDB</span>
        </div>
      </header>

      <form
        className="form-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onConnect(conn);
        }}
      >
        <Row label="Nombre">
          <input
            value={conn.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Mi cluster"
            autoFocus
          />
        </Row>

        <Row label="Etiqueta">
          <div className="inline">
            <select value={conn.tag} onChange={(e) => set("tag", e.target.value as Tag)}>
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
                  className={`swatch ${conn.color === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => set("color", c)}
                />
              ))}
            </div>
          </div>
        </Row>

        <div className="divider" />

        <Row label="Conectar con">
          <div className="segmented">
            <button
              type="button"
              className={conn.mode === "fields" ? "active" : ""}
              onClick={() => switchMode("fields")}
            >
              Host y credenciales
            </button>
            <button
              type="button"
              className={conn.mode === "uri" ? "active" : ""}
              onClick={() => switchMode("uri")}
            >
              URI
            </button>
          </div>
        </Row>
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
              <div className="inline">
                <input
                  className="grow"
                  value={conn.host}
                  onChange={(e) => set("host", e.target.value)}
                  placeholder="localhost"
                  spellCheck={false}
                />
                {!conn.srv && (
                  <>
                    <span className="muted">Puerto</span>
                    <input
                      className="port"
                      type="number"
                      min={1}
                      max={65535}
                      value={conn.port || ""}
                      onChange={(e) => set("port", Number(e.target.value))}
                    />
                  </>
                )}
              </div>
            </Row>
            <Row label="">
              <label className="check">
                <input type="checkbox" checked={conn.srv} onChange={(e) => set("srv", e.target.checked)} />
                Registro SRV <span className="muted">(mongodb+srv, p. ej. Atlas)</span>
              </label>
            </Row>

            <Row label="Usuario">
              <input
                value={conn.username}
                onChange={(e) => set("username", e.target.value)}
                placeholder="Opcional"
                spellCheck={false}
                autoComplete="off"
              />
            </Row>
            <Row label="Contraseña">
              <div className="inline">
                <input
                  className="grow"
                  type={showPassword ? "text" : "password"}
                  value={conn.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" className="ghost" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </Row>
            <Row label="Auth DB">
              <input
                value={conn.authDb}
                onChange={(e) => set("authDb", e.target.value)}
                placeholder="admin"
                spellCheck={false}
              />
            </Row>
            <Row label="Base de datos">
              <input
                value={conn.database}
                onChange={(e) => set("database", e.target.value)}
                placeholder="Opcional"
                spellCheck={false}
              />
            </Row>
            <Row label="">
              <label className="check">
                <input type="checkbox" checked={conn.tls} onChange={(e) => set("tls", e.target.checked)} />
                Usar TLS/SSL
              </label>
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
            <Row label="URI">
              <code className="uri-preview">{buildUri(conn, true)}</code>
            </Row>
          </>
        )}

        <TestResult state={test} />

        <div className="modal-footer">
          <button type="button" onClick={runTest} disabled={!canSubmit || test.status === "testing"}>
            {test.status === "testing" ? <Spinner /> : null} Probar
          </button>
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" onClick={() => onSave(conn)} disabled={!canSubmit}>
            Guardar
          </button>
          <button type="submit" className="primary" disabled={!canSubmit}>
            Conectar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <div className="row-field">{children}</div>
    </div>
  );
}

function TestResult({ state }: { state: TestState }) {
  if (state.status === "ok") {
    const n = state.info.databases.length;
    return (
      <p className="test ok">
        Conexión correcta · MongoDB {state.info.version} · {n} {n === 1 ? "base de datos" : "bases de datos"}
      </p>
    );
  }
  if (state.status === "error") return <p className="test error">{state.message}</p>;
  return null;
}
