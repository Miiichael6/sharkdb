import { describe, expect, it } from "vitest";
import { buildUri, favoritesOf, fieldsFromUri, maskUri, newConnection, parseUri, protectedAmong, protectedTwin, serverAddresses, type MongoConnection } from "./connection";

const conn = (patch: Partial<MongoConnection> = {}): MongoConnection => ({ ...newConnection(), ...patch });

describe("buildUri", () => {
  it("builds a plain host:port URI", () => {
    expect(buildUri(conn())).toBe("mongodb://localhost:27017/");
  });

  it("encodes credentials and adds authSource, tls, database and extra options", () => {
    const c = conn({
      username: "ana@corp",
      password: "p:ss/1",
      authDb: "admin",
      database: "shop",
      tls: true,
      options: "?retryWrites=true",
    });
    expect(buildUri(c)).toBe(
      "mongodb://ana%40corp:p%3Ass%2F1@localhost:27017/shop?authSource=admin&tls=true&retryWrites=true",
    );
  });

  it("omits the port for SRV hosts and masks the password on request", () => {
    const c = conn({ srv: true, host: "cluster.example.net", username: "ana", password: "secret" });
    expect(buildUri(c, true)).toBe("mongodb+srv://ana:••••@cluster.example.net/?authSource=admin");
  });

  it("returns the raw URI in uri mode", () => {
    const c = conn({ mode: "uri", uri: "  mongodb://u:pw@h:1/  " });
    expect(buildUri(c)).toBe("mongodb://u:pw@h:1/");
    expect(buildUri(c, true)).toBe("mongodb://u:••••@h:1/");
  });
});

describe("maskUri", () => {
  it("hides only the password", () => {
    expect(maskUri("mongodb+srv://user:secret@host/db")).toBe("mongodb+srv://user:••••@host/db");
  });

  it("leaves URIs without a password untouched", () => {
    expect(maskUri("mongodb://host:27017")).toBe("mongodb://host:27017");
  });
});

describe("parseUri", () => {
  it("splits every part and decodes credentials", () => {
    const p = parseUri("mongodb://ana%40corp:p%3Ass@h1:1,h2:2/shop?replicaSet=rs0")!;
    expect(p).toMatchObject({ srv: false, username: "ana@corp", password: "p:ss", hosts: "h1:1,h2:2", database: "shop" });
    expect(p.params.get("replicaSet")).toBe("rs0");
  });

  it("returns null for something that is not a Mongo URI", () => {
    expect(parseUri("http://example.com")).toBeNull();
  });
});

describe("fieldsFromUri", () => {
  it("moves a single-host URI into the form fields", () => {
    const c = fieldsFromUri(conn({ mode: "uri" }), "mongodb://ana:pw@db.local:27018/shop?authSource=users&ssl=true&w=majority")!;
    expect(c).toMatchObject({
      mode: "fields",
      host: "db.local",
      port: 27018,
      username: "ana",
      password: "pw",
      authDb: "users",
      database: "shop",
      tls: true,
      options: "w=majority",
    });
  });

  it("round-trips the advanced options without repeating them in the free-form field", () => {
    const c = conn({ replicaSet: "rs0", readPreference: "nearest", tls: true, options: "w=majority" });
    const back = fieldsFromUri(conn(), buildUri(c))!;
    expect(back).toMatchObject({ replicaSet: "rs0", readPreference: "nearest", tls: true, options: "w=majority" });
    expect(buildUri(back)).toBe(buildUri(c));
  });

  it("refuses replica-set host lists and invalid URIs", () => {
    expect(fieldsFromUri(conn(), "mongodb://h1,h2/db")).toBeNull();
    expect(fieldsFromUri(conn(), "nope")).toBeNull();
  });
});

describe("favoritesOf", () => {
  it("gives the favorites of a registered connection, none otherwise", () => {
    const shop = { ...newConnection(), favoriteDatabases: ["shop"] };
    expect(favoritesOf([shop], shop.id)).toEqual(["shop"]);
    expect(favoritesOf([shop], "other")).toEqual([]);
  });
});

describe("serverAddresses", () => {
  it("normalizes hosts, ports and loopbacks", () => {
    expect(serverAddresses(conn({ host: "127.0.0.1", port: 27017 }))).toEqual(["localhost:27017"]);
    expect(serverAddresses(conn({ mode: "uri", uri: "mongodb://u:p@DB1.corp,[::1]:27018/app?replicaSet=rs" }))).toEqual([
      "db1.corp:27017",
      "localhost:27018",
    ]);
    expect(serverAddresses(conn({ host: "cluster0.abc.net", srv: true }))).toEqual(["srv:cluster0.abc.net"]);
    expect(serverAddresses(conn({ mode: "uri", uri: "mongodb+srv://cluster0.abc.net/" }))).toEqual(["srv:cluster0.abc.net"]);
  });

  it("puts tunnelled hosts behind their SSH server", () => {
    const tunnelled = conn({ ssh: { ...newConnection().ssh, enabled: true, host: "Bastion", port: 2222 } });
    expect(serverAddresses(tunnelled)).toEqual(["ssh:bastion:2222>localhost:27017"]);
  });
});

describe("protectedAmong", () => {
  const prod = { ...newConnection(), name: "Prod", protected: true, host: "db.example.com" };

  it("is true for a protected connection", () => {
    expect(protectedAmong(prod, [prod])).toBe(true);
  });

  it("is true for an unmarked copy on the same server, which names its twin", () => {
    const copy = { ...newConnection(), mode: "uri" as const, uri: "mongodb://DB.example.com:27017/app" };
    expect(protectedAmong(copy, [prod, copy])).toBe(true);
    expect(protectedTwin(copy, [prod, copy])).toBe(prod);
  });

  it("is false on another server, or when the twin is only tagged production", () => {
    const other = { ...newConnection(), host: "dev.example.com" };
    expect(protectedAmong(other, [prod, other])).toBe(false);
    const tagged = { ...prod, id: "tagged", protected: false, tag: "production" as const };
    const copy = { ...newConnection(), host: "db.example.com" };
    expect(protectedAmong(copy, [tagged, copy])).toBe(false);
  });

  it("is not its own twin", () => {
    expect(protectedTwin(prod, [prod])).toBeUndefined();
  });
});
