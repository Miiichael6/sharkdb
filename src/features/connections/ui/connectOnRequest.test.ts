import { describe, expect, it, vi } from "vitest";
import { newConnection } from "../domain/connection";
import type { BorrowedSession } from "../domain/session";
import { holdConnections } from "./connectOnRequest";

const INFO = { version: "7.0.0", databases: [] };

function setup() {
  const releases = new Map<string, ReturnType<typeof vi.fn>>();
  const holdSession = vi.fn(async (id: string): Promise<BorrowedSession> => {
    const release = vi.fn(async () => {});
    releases.set(`${id}#${releases.size}`, release);
    return { session: { conn: { ...newConnection(), id }, safeMode: false, info: INFO }, release };
  });
  return { holdSession, releases, held: holdConnections(holdSession) };
}

describe("holdConnections", () => {
  it("holds each connection once, however many times it's asked", async () => {
    const { held, holdSession } = setup();
    await held.hold("a");
    await held.hold("b");
    await held.hold("a");
    expect(holdSession.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
  });

  it("gives back every hold at the end, and only once", async () => {
    const { held, releases } = setup();
    await held.hold("a");
    await held.hold("b");
    await held.release();
    await held.release();
    expect([...releases.values()].map((r) => r.mock.calls.length)).toEqual([1, 1]);
  });

  it("releases nothing, without failing, when nothing was held", async () => {
    const { held } = setup();
    await expect(held.release()).resolves.toBeUndefined();
  });

  it("keeps what it held when a later hold fails, so the caller can still give it back", async () => {
    const { held, holdSession, releases } = setup();
    await held.hold("a");
    holdSession.mockRejectedValueOnce("La conexión ya no existe");
    await expect(held.hold("b")).rejects.toBe("La conexión ya no existe");
    await held.release();
    expect([...releases.values()].map((r) => r.mock.calls.length)).toEqual([1]);
  });
});
