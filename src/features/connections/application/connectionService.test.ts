import { describe, expect, it, vi } from "vitest";
import { newConnection, type MongoConnection } from "../domain/connection";
import { createConnectionService } from "./connectionService";
import type { ConnectionStore, FilePicker, SessionGateway } from "./ports";

const INFO = { version: "7.0.0", databases: [] };

function setup(saved: MongoConnection[] = []) {
  const store: ConnectionStore = { load: vi.fn(async () => saved), save: vi.fn(async () => {}) };
  const gateway: SessionGateway = {
    test: vi.fn(async () => INFO),
    open: vi.fn(async () => INFO),
    setSafeMode: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const files: FilePicker = { pick: vi.fn(async () => "C:\\ca.pem") };
  return { store, gateway, files, service: createConnectionService(store, gateway, files) };
}

describe("connectionService", () => {
  it("migrates connections saved without the new fields", async () => {
    const { ssh: _ssh, tlsFiles: _tls, protected: _protected, ...old } = newConnection();
    const { service } = setup([old as MongoConnection]);
    const [loaded] = await service.list();
    expect(loaded.ssh.enabled).toBe(false);
    expect(loaded.protected).toBe(false);
    expect(loaded.tlsFiles.caFile).toBe("");
  });

  it("opens without a tunnel when SSH is disabled", async () => {
    const { service, gateway } = setup();
    const conn = newConnection();
    await service.open(conn);
    expect(gateway.open).toHaveBeenCalledWith(conn.id, "mongodb://localhost:27017/", null, false);
  });

  it("opens protected connections in safe mode", async () => {
    const { service, gateway } = setup();
    const conn = { ...newConnection(), protected: true };
    const session = await service.open(conn);
    expect(session.safeMode).toBe(true);
    expect(gateway.open).toHaveBeenCalledWith(conn.id, "mongodb://localhost:27017/", null, true);
  });

  it("switches safe mode in the backend before reporting it", async () => {
    const { service, gateway } = setup();
    const session = await service.open(newConnection());
    const next = await service.setSafeMode(session, true);
    expect(gateway.setSafeMode).toHaveBeenCalledWith(session.conn.id, true);
    expect(next).toEqual({ ...session, safeMode: true });
  });

  it("passes the tunnel settings when SSH is enabled", async () => {
    const { service, gateway } = setup();
    const conn = newConnection();
    conn.ssh = { ...conn.ssh, enabled: true, host: "bastion", username: "deploy", password: "pw" };
    await service.test(conn);
    expect(gateway.test).toHaveBeenCalledWith(
      "mongodb://localhost:27017/",
      expect.objectContaining({ host: "bastion", port: 22, username: "deploy", auth: "password", password: "pw" }),
    );
  });

  it("delegates file picking to the adapter", async () => {
    const { service, files } = setup();
    expect(await service.pickFile("CA")).toBe("C:\\ca.pem");
    expect(files.pick).toHaveBeenCalledWith("CA");
  });
});
