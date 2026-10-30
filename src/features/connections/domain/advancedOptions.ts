// Connection options beyond host and credentials: TLS certificates, replica set, read
// preference and timeouts. They travel as URI query parameters the driver understands.

export interface TlsFiles {
  /** PEM with the certificate authority that signed the server certificate. */
  caFile: string;
  /** PEM with the client certificate and its private key. */
  certificateKeyFile: string;
  allowInvalidCertificates: boolean;
}

export type ReadPreference = "primary" | "primaryPreferred" | "secondary" | "secondaryPreferred" | "nearest";

export interface AdvancedOptions {
  tls: boolean;
  tlsFiles: TlsFiles;
  replicaSet: string;
  readPreference: ReadPreference;
  connectTimeoutMs: number;
}

export const READ_PREFERENCES: ReadPreference[] = [
  "primary",
  "primaryPreferred",
  "secondary",
  "secondaryPreferred",
  "nearest",
];

export const DEFAULT_READ_PREFERENCE: ReadPreference = "primary";

/** Same value the backend uses when the URI doesn't set a timeout. */
export const DEFAULT_CONNECT_TIMEOUT_MS = 6000;

export const newTlsFiles = (): TlsFiles => ({ caFile: "", certificateKeyFile: "", allowInvalidCertificates: false });

const PARAM = {
  tls: "tls",
  ssl: "ssl",
  caFile: "tlsCAFile",
  certificateKeyFile: "tlsCertificateKeyFile",
  allowInvalid: "tlsAllowInvalidCertificates",
  replicaSet: "replicaSet",
  readPreference: "readPreference",
  connectTimeout: "connectTimeoutMS",
  serverSelectionTimeout: "serverSelectionTimeoutMS",
} as const;

const enc = encodeURIComponent;

/** Query parameters for the options that differ from the driver defaults. */
export function advancedParams(o: AdvancedOptions): string[] {
  const params: string[] = [];
  if (o.tls) {
    params.push(`${PARAM.tls}=true`);
    if (o.tlsFiles.caFile.trim()) params.push(`${PARAM.caFile}=${enc(o.tlsFiles.caFile.trim())}`);
    if (o.tlsFiles.certificateKeyFile.trim()) {
      params.push(`${PARAM.certificateKeyFile}=${enc(o.tlsFiles.certificateKeyFile.trim())}`);
    }
    if (o.tlsFiles.allowInvalidCertificates) params.push(`${PARAM.allowInvalid}=true`);
  }
  if (o.replicaSet.trim()) params.push(`${PARAM.replicaSet}=${enc(o.replicaSet.trim())}`);
  if (o.readPreference !== DEFAULT_READ_PREFERENCE) params.push(`${PARAM.readPreference}=${o.readPreference}`);
  if (o.connectTimeoutMs > 0 && o.connectTimeoutMs !== DEFAULT_CONNECT_TIMEOUT_MS) {
    // The same wait applies to opening the socket and to finding a usable server.
    params.push(`${PARAM.connectTimeout}=${o.connectTimeoutMs}`);
    params.push(`${PARAM.serverSelectionTimeout}=${o.connectTimeoutMs}`);
  }
  return params;
}

const isReadPreference = (v: string | null): v is ReadPreference =>
  READ_PREFERENCES.includes(v as ReadPreference);

/**
 * Reads the options `advancedParams` writes and removes them from `params`, so what's left
 * can stay in the free-form options field without being repeated.
 */
export function takeAdvancedParams(params: URLSearchParams, current: AdvancedOptions): AdvancedOptions {
  const tls = [PARAM.tls, PARAM.ssl].some((k) => params.get(k) === "true");
  const readPreference = params.get(PARAM.readPreference);
  const timeout = Number(params.get(PARAM.connectTimeout));
  const options: AdvancedOptions = {
    tls,
    tlsFiles: {
      caFile: params.get(PARAM.caFile) ?? "",
      certificateKeyFile: params.get(PARAM.certificateKeyFile) ?? "",
      allowInvalidCertificates: params.get(PARAM.allowInvalid) === "true",
    },
    replicaSet: params.get(PARAM.replicaSet) ?? "",
    readPreference: isReadPreference(readPreference) ? readPreference : DEFAULT_READ_PREFERENCE,
    connectTimeoutMs: timeout > 0 ? timeout : current.connectTimeoutMs,
  };
  Object.values(PARAM).forEach((k) => params.delete(k));
  return options;
}
