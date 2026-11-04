import { describe, expect, it } from "vitest";
import { filterDatabases, splitAddress } from "./databasePicker";

describe("splitAddress", () => {
  it("splits host and port", () => {
    expect(splitAddress("localhost:27017")).toEqual({ host: "localhost", port: "27017" });
  });

  it("keeps an SRV name or several hosts whole, without port", () => {
    expect(splitAddress("cluster0.example.net")).toEqual({ host: "cluster0.example.net", port: "" });
    expect(splitAddress("a:27017,b:27018")).toEqual({ host: "a:27017,b:27018", port: "" });
  });
});

describe("filterDatabases", () => {
  it("keeps the order and ignores case", () => {
    expect(filterDatabases(["OPE_IM", "sigo_db", "LOG_sigo_db"], "SIGO")).toEqual(["sigo_db", "LOG_sigo_db"]);
    expect(filterDatabases(["b", "a"], "  ")).toEqual(["b", "a"]);
  });
});
