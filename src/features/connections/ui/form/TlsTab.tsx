import type { TlsFiles } from "../../domain/advancedOptions";
import type { MongoConnection } from "../../domain/connection";
import { CheckRow } from "./CheckRow";
import { FilePathInput } from "./FilePathInput";
import { Row } from "./Row";
import { UriModeNote } from "./UriModeNote";
import type { SetField } from "./useConnectionForm";

interface Props {
  conn: MongoConnection;
  set: SetField;
}

export function TlsTab({ conn, set }: Props) {
  if (conn.mode === "uri") return <UriModeNote example="tls=true&tlsCAFile=C%3A%5Cca.pem" />;

  const files = conn.tlsFiles;
  const update = (patch: Partial<TlsFiles>) => set("tlsFiles", { ...files, ...patch });

  return (
    <>
      <CheckRow checked={conn.tls} onChange={(v) => set("tls", v)}>
        Usar TLS/SSL
      </CheckRow>
      <fieldset className="plain-fieldset" disabled={!conn.tls}>
        <Row label="CA">
          <FilePathInput
            value={files.caFile}
            onChange={(caFile) => update({ caFile })}
            dialogTitle="Certificado de la autoridad (CA)"
            placeholder="Opcional: PEM de la CA"
          />
        </Row>
        <Row label="Cert. cliente">
          <FilePathInput
            value={files.certificateKeyFile}
            onChange={(certificateKeyFile) => update({ certificateKeyFile })}
            dialogTitle="Certificado y clave del cliente"
            placeholder="Opcional: PEM con certificado y clave"
          />
        </Row>
        <CheckRow
          checked={files.allowInvalidCertificates}
          onChange={(allowInvalidCertificates) => update({ allowInvalidCertificates })}
        >
          Permitir certificados inválidos <span className="muted">(autofirmados, nombre distinto)</span>
        </CheckRow>
      </fieldset>
    </>
  );
}
