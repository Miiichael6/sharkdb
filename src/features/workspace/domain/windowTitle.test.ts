import { describe, expect, it } from "vitest";
import { TAGS } from "../../connections/domain/connection";
import { APP_TITLE, windowTitle } from "./windowTitle";

describe("windowTitle", () => {
  it("is just the app name without an active connection", () => {
    expect(windowTitle()).toBe(APP_TITLE);
  });

  it("shows the connection and its environment", () => {
    expect(windowTitle({ connection: "Clientes", tag: "production" })).toBe("SharkDB · Clientes · PRODUCTION");
  });

  it.each(TAGS)("names the %s tag in capitals", (tag) => {
    expect(windowTitle({ connection: "QA", tag })).toBe(`SharkDB · QA · ${tag.toUpperCase()}`);
  });
});
