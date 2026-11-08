import { describe, expect, it } from "vitest";
import { newConnection, type MongoConnection, type Tag } from "./connection";
import {
  PROTECTED_TARGET,
  SAFE_MODE_TARGET,
  connectionAddress,
  connectionEndpoint,
  pickTarget,
  sourceOptions,
  targetOptions,
  writeBlockReason,
} from "./endpoints";
import type { Session } from "./session";

const connection = (id: string, over: { protected?: boolean; tag?: Tag } = {}): MongoConnection => ({
  ...newConnection(),
  id,
  name: id,
  // Each on its own server: two entries for the same one share its protection.
  host: `${id}.corp`,
  protected: !!over.protected,
  tag: over.tag ?? "development",
});

const session = (conn: MongoConnection, safeMode = false): Session => ({
  conn,
  info: { version: "7.0", databases: [] },
  safeMode,
});

const PROD = connection("prod", { protected: true });
const PROD2 = connection("prod2", { tag: "production" });
const QA = connection("qa");
const LOCAL = connection("local", { tag: "local" });
const RO = connection("ro");
const CONNECTIONS = [PROD, PROD2, QA, LOCAL, RO];
const ids = (options: { id: string }[]) => options.map((o) => o.id);

describe("endpoints", () => {
  it("never writes to protected, production or safe-mode sessions", () => {
    expect(writeBlockReason(session(QA))).toBeUndefined();
    expect(writeBlockReason(session(PROD))).toBe(PROTECTED_TARGET);
    expect(writeBlockReason(session(PROD2))).toBe(PROTECTED_TARGET);
    expect(writeBlockReason(session(QA, true))).toBe(SAFE_MODE_TARGET);
  });

  it("offers closed connections as destination, never a protected or production one", () => {
    const sessions = [session(PROD), session(QA), session(RO, true)];
    expect(targetOptions(CONNECTIONS, sessions, "prod").map((t) => [t.id, t.connected, t.blocked])).toEqual([
      ["qa", true, undefined],
      ["local", false, undefined],
      ["ro", true, SAFE_MODE_TARGET],
    ]);
    // Closed or open, production never appears.
    expect(ids(targetOptions(CONNECTIONS, []))).toEqual(["qa", "local", "ro"]);
  });

  it("offers every registered connection as source, open or closed", () => {
    expect(sourceOptions(CONNECTIONS, [session(PROD)]).map((s) => [s.id, s.connected])).toEqual([
      ["prod", true],
      ["prod2", false],
      ["qa", false],
      ["local", false],
      ["ro", false],
    ]);
  });

  it("never offers the source as destination", () => {
    expect(ids(targetOptions(CONNECTIONS, [], "qa"))).not.toContain("qa");
  });

  it("swaps the ends when the destination is chosen as source, even with only two connections", () => {
    const two = [QA, LOCAL];
    // From local the destination is QA; QA stays offered as source.
    expect(pickTarget(targetOptions(two, [], "local"), "")).toBe("qa");
    expect(ids(sourceOptions(two, []))).toContain("qa");
    // Choosing QA as source moves the destination to local.
    expect(pickTarget(targetOptions(two, [], "qa"), "qa")).toBe("local");
  });

  it("moves the destination when it's no longer offered", () => {
    const targets = targetOptions(CONNECTIONS, [session(RO, true)], "local");
    expect(pickTarget(targets, "local")).toBe("qa");
    expect(pickTarget(targets, "qa")).toBe("qa");
    // A production origin is never kept as destination.
    expect(pickTarget(targetOptions(CONNECTIONS, []), "prod")).toBe("qa");
    // Only a blocked one is left: it isn't picked on its own.
    expect(pickTarget(targetOptions([QA, RO], [session(RO, true)], "qa"), "qa")).toBe("");
    expect(pickTarget([], "qa")).toBe("");
  });

  it("keeps a chosen destination in safe mode, blocked, instead of jumping to another one", () => {
    const targets = targetOptions(CONNECTIONS, [session(RO, true)], "local");
    expect(pickTarget(targets, "ro")).toBe("ro");
    expect(targets.find((t) => t.id === "ro")?.blocked).toBe(SAFE_MODE_TARGET);
  });

  it("names a connection by its id when it's no longer registered", () => {
    expect(connectionEndpoint(CONNECTIONS, "local")).toEqual({ name: "local", tag: "local", address: "local.corp:27017" });
    expect(connectionEndpoint(CONNECTIONS, "gone")).toEqual({ name: "gone" });
  });

  it("never offers a connection to the same server as a protected one", () => {
    const alias = { ...connection("alias"), mode: "uri" as const, uri: "mongodb://user@PROD.corp:27017/app" };
    const tunnel = { ...connection("tunnel"), host: "prod.corp", ssh: { ...QA.ssh, enabled: true, host: "bastion" } };
    expect(ids(targetOptions([...CONNECTIONS, alias, tunnel], []))).toEqual(["qa", "local", "ro", "tunnel"]);
  });

  it("restore offers production marked, held back only by safe mode, and never picks it for the user", () => {
    const alias = { ...connection("alias"), mode: "uri" as const, uri: "mongodb://PROD.corp:27017/app" };
    const all = [...CONNECTIONS, alias];
    const targets = targetOptions(all, [session(PROD, true), session(PROD2)], "", true);
    expect(targets.map((t) => [t.id, !!t.production, t.blocked])).toEqual([
      ["prod", true, SAFE_MODE_TARGET],
      ["prod2", true, undefined],
      ["qa", false, undefined],
      ["local", false, undefined],
      ["ro", false, undefined],
      ["alias", true, undefined],
    ]);
    expect(writeBlockReason(session(PROD2), true)).toBeUndefined();
    expect(pickTarget(targets, "prod2")).toBe("prod2");
    expect(pickTarget(targets, "")).toBe("qa");
    expect(pickTarget(targetOptions([PROD2], [], "", true), "")).toBe("");
    // Sync keeps never offering it, and a source carries no mark.
    expect(targetOptions(all, []).some((t) => t.production)).toBe(false);
    expect(sourceOptions(all, []).some((s) => "production" in s)).toBe(false);
  });
});

describe("connectionAddress", () => {
  const withSsh = (conn: MongoConnection, port = 22) => ({ ...conn, ssh: { ...conn.ssh, enabled: true, host: "bastion", port } });
  const byUri = (uri: string) => ({ ...connection("u"), mode: "uri" as const, uri });

  it("shows host and port of the fields, the SRV host alone", () => {
    expect(connectionAddress({ ...connection("q"), host: "10.0.4.12", port: 27018 })).toBe("10.0.4.12:27018");
    expect(connectionAddress({ ...connection("q"), host: "cluster.mongodb.net", srv: true })).toBe("cluster.mongodb.net");
  });

  it("shows every host of a URI, never its user or password", () => {
    expect(connectionAddress(byUri("mongodb://admin:secret@a:27017,b:27018/app?replicaSet=rs"))).toBe("a:27017,b:27018");
    expect(connectionAddress(byUri("not a uri admin:secret"))).toBe("");
  });

  it("adds the SSH tunnel, also when the address is unknown", () => {
    expect(connectionAddress(withSsh({ ...connection("q"), host: "10.0.4.12" }))).toBe("10.0.4.12:27017 (vía SSH bastion:22)");
    expect(connectionAddress(withSsh(byUri("garbage"), 2222))).toBe("vía SSH bastion:2222");
  });
});
