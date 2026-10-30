import { describe, expect, it } from "vitest";
import { ACTION_COMMANDS, blockedInSafeMode, isWriteAction } from "./writeActions";

describe("writeActions", () => {
  it("treats every mapped action as a write", () => {
    for (const action of Object.keys(ACTION_COMMANDS)) expect(isWriteAction(action)).toBe(true);
  });

  it("leaves reads and navigation alone", () => {
    for (const action of ["openShell", "refresh", "dbStats", "collStats", "view", "serverStatus", "disconnect"])
      expect(isWriteAction(action)).toBe(false);
  });

  it("blocks writes and the unrestricted mongosh in safe mode", () => {
    expect(blockedInSafeMode("dropCollection")).toBe(true);
    expect(blockedInSafeMode("openMongosh")).toBe(true);
    expect(blockedInSafeMode("openShell")).toBe(false);
  });

  it("blocks the collection menu entries that write, but not the read-only scripts", () => {
    for (const action of ["updateDocuments", "removeDocuments", "duplicateCollection", "copyCollection"])
      expect(blockedInSafeMode(action)).toBe(true);
    for (const action of ["viewDocuments", "shardVersion", "shardDistribution"]) expect(blockedInSafeMode(action)).toBe(false);
  });

  it("blocks rebuilding indexes, but not viewing them or the server log", () => {
    expect(blockedInSafeMode("rebuildIndexes")).toBe(true);
    for (const action of ["viewIndexes", "showLog"]) expect(blockedInSafeMode(action)).toBe(false);
  });
});
