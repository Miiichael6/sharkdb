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
    const typed: DestructiveAction[] = ["dropDatabase", "dropCollection", "removeAllDocuments", "dropUser", "dropIndex"];
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
    expect(deleteWindowHeight("typed")).toBeGreaterThan(deleteWindowHeight("simple"));
    expect(DELETE_WINDOW_WIDTH).toBeGreaterThan(0);
  });
});
