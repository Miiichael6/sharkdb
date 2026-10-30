import { describe, expect, it } from "vitest";
import type { TerminalGateway } from "./ports";
import { DEFAULT_SHELL_DB } from "../../shell/domain/tabs";
import { createTerminalService } from "./terminalService";

function fakeGateway() {
  const opened: [string, string][] = [];
  const gateway: TerminalGateway = {
    openMongosh: async (sid, db) => {
      opened.push([sid, db]);
    },
  };
  return { gateway, opened };
}

describe("terminalService", () => {
  it("opens mongosh on the given database, or the default one", async () => {
    const { gateway, opened } = fakeGateway();
    const terminal = createTerminalService(gateway);
    await terminal.openMongosh("s1", "shop");
    await terminal.openMongosh("s1");
    await terminal.openMongosh("s1", " ");
    expect(opened).toEqual([
      ["s1", "shop"],
      ["s1", DEFAULT_SHELL_DB],
      ["s1", DEFAULT_SHELL_DB],
    ]);
  });
});
