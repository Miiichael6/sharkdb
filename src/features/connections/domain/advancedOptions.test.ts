import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  advancedParams,
  newTlsFiles,
  takeAdvancedParams,
  type AdvancedOptions,
} from "./advancedOptions";

const options = (patch: Partial<AdvancedOptions> = {}): AdvancedOptions => ({
  tls: false,
  tlsFiles: newTlsFiles(),
  replicaSet: "",
  readPreference: "primary",
  connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
  ...patch,
});

const full = options({
  tls: true,
  tlsFiles: { caFile: "C:\\certs\\ca.pem", certificateKeyFile: "/home/ana/client.pem", allowInvalidCertificates: true },
  replicaSet: "rs0",
  readPreference: "secondaryPreferred",
  connectTimeoutMs: 15000,
});

describe("advancedParams", () => {
  it("adds nothing when everything is at its default", () => {
    expect(advancedParams(options())).toEqual([]);
  });

  it("encodes file paths and writes every non-default option", () => {
    expect(advancedParams(full)).toEqual([
      "tls=true",
      "tlsCAFile=C%3A%5Ccerts%5Cca.pem",
      "tlsCertificateKeyFile=%2Fhome%2Fana%2Fclient.pem",
      "tlsAllowInvalidCertificates=true",
      "replicaSet=rs0",
      "readPreference=secondaryPreferred",
      "connectTimeoutMS=15000",
      "serverSelectionTimeoutMS=15000",
    ]);
  });

  it("ignores TLS files while TLS is off", () => {
    expect(advancedParams(options({ tlsFiles: full.tlsFiles }))).toEqual([]);
  });
});

describe("takeAdvancedParams", () => {
  it("reads back what advancedParams wrote and leaves only unknown options", () => {
    const params = new URLSearchParams([...advancedParams(full), "w=majority"].join("&"));
    expect(takeAdvancedParams(params, options())).toEqual(full);
    expect(params.toString()).toBe("w=majority");
  });

  it("accepts ssl=true and falls back on invalid values", () => {
    const params = new URLSearchParams("ssl=true&readPreference=bogus&connectTimeoutMS=abc");
    expect(takeAdvancedParams(params, options({ connectTimeoutMs: 9000 }))).toMatchObject({
      tls: true,
      readPreference: "primary",
      connectTimeoutMs: 9000,
    });
  });
});
