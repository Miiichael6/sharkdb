import { useState } from "react";
import { Avatar, Modal, Spinner } from "../../../shared/ui/common";
import type { MongoConnection } from "../domain/connection";
import { AdvancedTab } from "./form/AdvancedTab";
import { AuthTab } from "./form/AuthTab";
import { ConnectionTab } from "./form/ConnectionTab";
import { SshTab } from "./form/SshTab";
import { TestResult } from "./form/TestResult";
import { TlsTab } from "./form/TlsTab";
import { useConnectionForm } from "./form/useConnectionForm";

type FormTab = "connection" | "auth" | "ssh" | "tls" | "advanced";

const TABS: [FormTab, string][] = [
  ["connection", "Conexión"],
  ["auth", "Autenticación"],
  ["ssh", "SSH"],
  ["tls", "TLS"],
  ["advanced", "Avanzado"],
];

interface Props {
  initial: MongoConnection;
  isNew: boolean;
  onSave: (c: MongoConnection) => void;
  onConnect: (c: MongoConnection) => void;
  onClose: () => void;
}

export function ConnectionForm({ initial, isNew, onSave, onConnect, onClose }: Props) {
  const { conn, set, switchMode, modeError, canSubmit, test, runTest } = useConnectionForm(initial);
  const [tab, setTab] = useState<FormTab>("connection");

  return (
    <Modal onClose={onClose} className="conn-form">
      <header className="form-header">
        <Avatar color={conn.color} size={40} />
        <div>
          <h2>{isNew ? "Nueva conexión" : "Editar conexión"}</h2>
          <span className="muted">MongoDB</span>
        </div>
      </header>

      <div className="tabs conn-form-tabs" role="tablist" aria-label="Secciones de la conexión">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "ssh" && conn.ssh.enabled && <span className="tab-dot" aria-label="activo" />}
          </button>
        ))}
      </div>

      <form
        className="form-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onConnect(conn);
        }}
      >
        <div className="conn-tab-body" role="tabpanel">
          {tab === "connection" && (
            <ConnectionTab conn={conn} set={set} modeError={modeError} onSwitchMode={switchMode} />
          )}
          {tab === "auth" && <AuthTab conn={conn} set={set} />}
          {tab === "ssh" && <SshTab conn={conn} set={set} />}
          {tab === "tls" && <TlsTab conn={conn} set={set} />}
          {tab === "advanced" && <AdvancedTab conn={conn} set={set} />}
        </div>

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
