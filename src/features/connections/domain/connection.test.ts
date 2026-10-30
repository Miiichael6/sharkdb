import { describe, expect, it } from "vitest";
import { buildUri, fieldsFromUri, maskUri, newConnection, parseUri, type MongoConnection } from "./connection";

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

  it("refuses replica-set host lists and invalid URIs", () => {
    expect(fieldsFromUri(conn(), "mongodb://h1,h2/db")).toBeNull();
    expect(fieldsFromUri(conn(), "nope")).toBeNull();
  });
});
