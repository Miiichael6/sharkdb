export type SshAuthMethod = "password" | "key";

export interface SshSettings {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  auth: SshAuthMethod;
  password: string;
  privateKeyPath: string;
  /** Unlocks an encrypted private key; empty when the key has none. */
  passphrase: string;
}

/** What the backend needs to open the tunnel (only sent when SSH is enabled). */
export interface SshTunnelConfig {
  host: string;
  port: number;
  username: string;
  auth: SshAuthMethod;
  password: string;
  privateKeyPath: string;
  passphrase: string;
}

export const DEFAULT_SSH_PORT = 22;

export const SSH_AUTH_LABELS: Record<SshAuthMethod, string> = {
  password: "Contraseña",
  key: "Clave privada",
};

export const newSshSettings = (): SshSettings => ({
  enabled: false,
  host: "",
  port: DEFAULT_SSH_PORT,
  username: "",
  auth: "password",
  password: "",
  privateKeyPath: "",
  passphrase: "",
});

/** True when SSH is off, or when it has everything needed to try the tunnel. */
export function isSshComplete(ssh: SshSettings): boolean {
  if (!ssh.enabled) return true;
  if (!ssh.host.trim() || !ssh.username.trim()) return false;
  return ssh.auth === "key" ? !!ssh.privateKeyPath.trim() : true;
}

export function sshTunnelConfig(ssh: SshSettings): SshTunnelConfig | null {
  if (!ssh.enabled) return null;
  return {
    host: ssh.host.trim(),
    port: ssh.port || DEFAULT_SSH_PORT,
    username: ssh.username.trim(),
    auth: ssh.auth,
    password: ssh.auth === "password" ? ssh.password : "",
    privateKeyPath: ssh.auth === "key" ? ssh.privateKeyPath.trim() : "",
    passphrase: ssh.auth === "key" ? ssh.passphrase : "",
  };
}
