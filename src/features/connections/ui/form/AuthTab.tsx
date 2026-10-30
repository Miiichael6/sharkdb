import type { MongoConnection } from "../../domain/connection";
import { PasswordInput } from "./PasswordInput";
import { Row } from "./Row";
import { UriModeNote } from "./UriModeNote";
import type { SetField } from "./useConnectionForm";

interface Props {
  conn: MongoConnection;
  set: SetField;
}

export function AuthTab({ conn, set }: Props) {
  if (conn.mode === "uri") return <UriModeNote example="mongodb://usuario:contraseña@host/?authSource=admin" />;

  return (
    <>
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
        <PasswordInput value={conn.password} onChange={(v) => set("password", v)} />
      </Row>
      <Row label="Auth DB">
        <input value={conn.authDb} onChange={(e) => set("authDb", e.target.value)} placeholder="admin" spellCheck={false} />
      </Row>
      <Row label="Base de datos">
        <input
          value={conn.database}
          onChange={(e) => set("database", e.target.value)}
          placeholder="Opcional"
          spellCheck={false}
        />
      </Row>
    </>
  );
}
