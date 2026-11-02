import { describe, expect, it } from "vitest";
import {
  DELETE_WINDOW_WIDTH,
  canConfirmDeletion,
  confirmLevel,
  deleteWindowHeight,
  destructiveRequest,
  type DestructiveAction,
} from "./destructiveActions";

const server = { name: "QA", host: "qa.example:27017", tag: "QA" };

describe("confirmLevel", () => {
  it("asks for the word on everything that deletes data in the server (D12)", () => {
    const typed: DestructiveAction[] = ["dropDatabase", "dropCollection", "replaceCollection", "removeAllDocuments", "dropUser", "dropIndex"];
    for (const action of typed) expect(confirmLevel(action)).toBe("typed");
  });

  it("keeps one click for selected documents, functions and saved connections", () => {
    const simple: DestructiveAction[] = ["removeDocuments", "removeFunction", "deleteConnection", "deleteSchedule"];
    for (const action of simple) expect(confirmLevel(action)).toBe("simple");
  });
});

describe("destructiveRequest", () => {
  it("names the database and keeps the connection and its environment", () => {
    const request = destructiveRequest("dropDatabase", { server, db: "shop" });
    expect(request).toMatchObject({
      title: "Eliminar base de datos",
      level: "typed",
      where: { server, db: "shop" },
      subject: "la base de datos “shop”",
      confirmLabel: "Eliminar base de datos",
    });
    expect(request.loses).toContain("colecciones");
  });

  it("tells a view from a collection", () => {
    const coll = destructiveRequest("dropCollection", { server, db: "shop", coll: "orders" });
    const view = destructiveRequest("dropCollection", { server, db: "shop", coll: "open_orders", view: true });
    expect(coll.subject).toBe("la colección “orders”");
    expect(view.subject).toBe("la vista “open_orders”");
    expect(view.loses).toContain("se conserva");
  });

  it("names the index or user inside the collection or database", () => {
    const index = destructiveRequest("dropIndex", { server, db: "shop", coll: "orders", name: "by_date" });
    expect(index.subject).toBe("el índice “by_date”");
    expect(index.where).toEqual({ server, db: "shop", coll: "orders" });
    expect(destructiveRequest("dropUser", { server, db: "admin", name: "ana" }).subject).toBe("el usuario “ana”");
  });

  it("counts the selected documents", () => {
    expect(destructiveRequest("removeDocuments", { server, db: "shop", coll: "orders", count: 1 })).toMatchObject({
      title: "Eliminar documento",
      subject: "1 documento",
    });
    expect(destructiveRequest("removeDocuments", { server, db: "shop", coll: "orders", count: 3 }).subject).toBe(
      "3 documentos",
    );
  });

  it("says a saved connection leaves the server untouched", () => {
    const request = destructiveRequest("deleteConnection", { server });
    expect(request.subject).toBe("la conexión “QA”");
    expect(request.where).toEqual({ server, db: undefined, coll: undefined });
    expect(request.loses).toContain("no se tocan");
  });
});

describe("destructiveRequest on MongoDB's own namespaces", () => {
  it("warns before dropping a system database, saying what it holds", () => {
    expect(destructiveRequest("dropDatabase", { server, db: "admin" }).warning).toBe(
      "“admin” es una base de datos del sistema: guarda los usuarios, los roles y la configuración del servidor.",
    );
    expect(destructiveRequest("dropDatabase", { server, db: "local" }).warning).toContain("oplog");
    expect(destructiveRequest("dropDatabase", { server, db: "config" }).warning).toContain("sharding");
  });

  it("warns before emptying or dropping a system.* collection, in any database", () => {
    const empty = destructiveRequest("removeAllDocuments", { server, db: "admin", coll: "system.users" });
    expect(empty.warning).toBe("“system.users” es una colección interna de MongoDB: el servidor depende de ella.");
    expect(empty.level).toBe("typed");
    expect(destructiveRequest("dropCollection", { server, db: "shop", coll: "system.views" }).warning).toContain(
      "system.views",
    );
    expect(destructiveRequest("removeDocuments", { server, db: "shop", coll: "system.js", count: 1 }).warning).toBeDefined();
  });

  it("warns for a user collection inside a system database", () => {
    expect(destructiveRequest("dropCollection", { server, db: "local", coll: "notes" }).warning).toContain("“local”");
  });

  it("says nothing for the user's own databases and collections", () => {
    expect(destructiveRequest("dropDatabase", { server, db: "shop" }).warning).toBeUndefined();
    expect(destructiveRequest("dropCollection", { server, db: "shop", coll: "systems" }).warning).toBeUndefined();
    expect(destructiveRequest("dropCollection", { server, db: "administration", coll: "orders" }).warning).toBeUndefined();
    expect(destructiveRequest("deleteConnection", { server }).warning).toBeUndefined();
  });

  it("doesn't warn where deleting is the usual thing: users in admin, functions in system.js", () => {
    expect(destructiveRequest("dropUser", { server, db: "admin", name: "ana" }).warning).toBeUndefined();
    expect(destructiveRequest("removeFunction", { server, db: "shop", coll: "system.js", name: "f" }).warning).toBeUndefined();
  });
});

describe("canConfirmDeletion", () => {
  it("waits for the confirmation word at typed, ignoring case and spaces at the ends", () => {
    expect(canConfirmDeletion("typed", "")).toBe(false);
    expect(canConfirmDeletion("typed", "confirm")).toBe(false);
    expect(canConfirmDeletion("typed", "  CONFIRMO ")).toBe(true);
  });

  it("lets a simple one go with one click", () => {
    expect(canConfirmDeletion("simple", "")).toBe(true);
  });
});

describe("delete window size", () => {
  it("is taller when it has the confirmation field", () => {
    expect(deleteWindowHeight({ level: "typed" })).toBeGreaterThan(deleteWindowHeight({ level: "simple" }));
    expect(DELETE_WINDOW_WIDTH).toBeGreaterThan(0);
  });

  it("makes room for the system warning", () => {
    const warning = "“admin” es una base de datos del sistema.";
    expect(deleteWindowHeight({ level: "typed", warning })).toBeGreaterThan(deleteWindowHeight({ level: "typed" }));
    expect(deleteWindowHeight({ level: "simple", warning })).toBeGreaterThan(deleteWindowHeight({ level: "simple" }));
  });
});
