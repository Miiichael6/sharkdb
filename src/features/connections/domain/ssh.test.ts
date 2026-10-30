import { describe, expect, it } from "vitest";
import { isSshComplete, newSshSettings, sshTunnelConfig, type SshSettings } from "./ssh";

const ssh = (patch: Partial<SshSettings> = {}): SshSettings => ({
  ...newSshSettings(),
  enabled: true,
  host: " bastion ",
  username: "deploy",
  ...patch,
});

describe("sshTunnelConfig", () => {
  it("is null while SSH is disabled", () => {
    expect(sshTunnelConfig(newSshSettings())).toBeNull();
  });

  it("sends only the secret of the chosen auth method", () => {
    const byPassword = sshTunnelConfig(ssh({ password: "pw", privateKeyPath: "~/.ssh/id", passphrase: "x" }))!;
    expect(byPassword).toMatchObject({ host: "bastion", port: 22, auth: "password", password: "pw", privateKeyPath: "", passphrase: "" });

    const byKey = sshTunnelConfig(ssh({ auth: "key", password: "pw", privateKeyPath: " C:\\keys\\id ", passphrase: "x" }))!;
    expect(byKey).toMatchObject({ auth: "key", password: "", privateKeyPath: "C:\\keys\\id", passphrase: "x" });
  });
});

describe("isSshComplete", () => {
  it("needs host, user and, for key auth, the key file", () => {
    expect(isSshComplete(newSshSettings())).toBe(true);
    expect(isSshComplete(ssh())).toBe(true);
    expect(isSshComplete(ssh({ host: "" }))).toBe(false);
    expect(isSshComplete(ssh({ username: " " }))).toBe(false);
    expect(isSshComplete(ssh({ auth: "key" }))).toBe(false);
    expect(isSshComplete(ssh({ auth: "key", privateKeyPath: "id_rsa" }))).toBe(true);
  });
});
