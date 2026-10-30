import type { MongoConnection } from "../../domain/connection";
import { DEFAULT_SSH_PORT, SSH_AUTH_LABELS, type SshAuthMethod, type SshSettings } from "../../domain/ssh";
import { CheckRow } from "./CheckRow";
import { FilePathInput } from "./FilePathInput";
import { PasswordInput } from "./PasswordInput";
import { Row } from "./Row";
import type { SetField } from "./useConnectionForm";

interface Props {
  conn: MongoConnection;
  set: SetField;
}

const AUTH_METHODS = Object.keys(SSH_AUTH_LABELS) as SshAuthMethod[];

/** Tunnel through a bastion host; applies to both connection modes. */
export function SshTab({ conn, set }: Props) {
  const ssh = conn.ssh;
  const update = (patch: Partial<SshSettings>) => set("ssh", { ...ssh, ...patch });

  return (
    <>
      <CheckRow checked={ssh.enabled} onChange={(enabled) => update({ enabled })}>
        Conectar a través de un túnel SSH
      </CheckRow>
      <fieldset className="plain-fieldset" disabled={!ssh.enabled}>
        <Row label="Servidor SSH">
          <input
            value={ssh.host}
            onChange={(e) => update({ host: e.target.value })}
            placeholder="bastion.example.com"
            spellCheck={false}
          />
        </Row>
        <Row label="Puerto">
          <input
            className="port"
            type="number"
            min={1}
            max={65535}
            value={ssh.port || ""}
            onChange={(e) => update({ port: Number(e.target.value) || DEFAULT_SSH_PORT })}
          />
        </Row>
        <Row label="Usuario">
          <input
            value={ssh.username}
            onChange={(e) => update({ username: e.target.value })}
            spellCheck={false}
            autoComplete="off"
          />
        </Row>
        <Row label="Autenticación">
          <select value={ssh.auth} onChange={(e) => update({ auth: e.target.value as SshAuthMethod })}>
            {AUTH_METHODS.map((m) => (
              <option key={m} value={m}>
                {SSH_AUTH_LABELS[m]}
              </option>
            ))}
          </select>
        </Row>
        {ssh.auth === "password" ? (
          <Row label="Contraseña">
            <PasswordInput value={ssh.password} onChange={(password) => update({ password })} />
          </Row>
        ) : (
          <>
            <Row label="Clave privada">
              <FilePathInput
                value={ssh.privateKeyPath}
                onChange={(privateKeyPath) => update({ privateKeyPath })}
                dialogTitle="Clave privada SSH"
                placeholder="C:\Users\yo\.ssh\id_ed25519"
              />
            </Row>
            <Row label="Passphrase">
              <PasswordInput
                value={ssh.passphrase}
                onChange={(passphrase) => update({ passphrase })}
                placeholder="Solo si la clave está cifrada"
              />
            </Row>
          </>
        )}
        <p className="muted form-note">
          Con túnel, la conexión va a un único servidor (sin descubrir el resto del replica set). La primera vez se
          acepta la huella del servidor SSH y después se rechaza si cambia.
        </p>
      </fieldset>
    </>
  );
}
