interface Props {
  /** Example of the URI parameters that replace this tab, e.g. `replicaSet=rs0`. */
  example: string;
}

/** Shown in tabs whose settings are part of the URI when the connection is in URI mode. */
export function UriModeNote({ example }: Props) {
  return (
    <p className="muted form-note">
      En modo URI estas opciones se escriben en la propia URI, p. ej. <code>{example}</code>.
    </p>
  );
}
