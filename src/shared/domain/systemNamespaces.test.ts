import { describe, expect, it } from "vitest";
import { isSystemCollection, isSystemDatabase, systemNamespaceWarning } from "./systemNamespaces";

describe("isSystemDatabase", () => {
  it("knows admin, config and local, and only by their exact name", () => {
    for (const db of ["admin", "config", "local"]) expect(isSystemDatabase(db)).toBe(true);
    for (const db of ["shop", "Admin", "localhost", "configs"]) expect(isSystemDatabase(db)).toBe(false);
  });
});

describe("isSystemCollection", () => {
  it("knows the system. prefix", () => {
    for (const coll of ["system.users", "system.js", "system.views", "system.profile"]) {
      expect(isSystemCollection(coll)).toBe(true);
    }
    for (const coll of ["systems", "system", "my.system.users", "orders"]) expect(isSystemCollection(coll)).toBe(false);
  });
});

describe("systemNamespaceWarning", () => {
  it("names the collection first when it is a system one, even inside a system database", () => {
    expect(systemNamespaceWarning("admin", "system.roles")).toContain("“system.roles”");
  });

  it("falls back to the database", () => {
    expect(systemNamespaceWarning("config")).toBe(
      "“config” es una base de datos del sistema: guarda los metadatos del sharding y de las sesiones.",
    );
  });

  it("is undefined for the user's own namespaces or when nothing is given", () => {
    expect(systemNamespaceWarning("shop", "orders")).toBeUndefined();
    expect(systemNamespaceWarning()).toBeUndefined();
  });
});
