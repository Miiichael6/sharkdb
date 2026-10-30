import { describe, expect, it } from "vitest";
import type { ScriptFiles } from "./ports";
import { createScriptFileService, suggestedScriptName } from "./scriptFileService";

function fakeFiles(picked: string | null) {
  const disk: Record<string, string> = { "C:/q.js": "db.x.find({})" };
  const asked: string[] = [];
  const files: ScriptFiles = {
    pickOpen: async () => picked,
    pickSave: async (name) => {
      asked.push(name);
      return picked;
    },
    read: async (path) => disk[path],
    write: async (path, content) => {
      disk[path] = content;
    },
  };
  return { files, disk, asked };
}

describe("scriptFileService", () => {
  it("opens the picked file, or nothing if cancelled", async () => {
    expect(await createScriptFileService(fakeFiles("C:/q.js").files).open()).toEqual({ path: "C:/q.js", content: "db.x.find({})" });
    expect(await createScriptFileService(fakeFiles(null).files).open()).toBeNull();
  });

  it("saves in place when the tab has a file, without asking", async () => {
    const { files, disk, asked } = fakeFiles("C:/other.js");
    expect(await createScriptFileService(files).save("1", "C:/q.js", "q.js")).toBe("C:/q.js");
    expect(disk["C:/q.js"]).toBe("1");
    expect(asked).toEqual([]);
  });

  it("asks for a path for new tabs and on save as", async () => {
    const { files, disk, asked } = fakeFiles("C:/new.js");
    const service = createScriptFileService(files);
    expect(await service.save("2", null, "test")).toBe("C:/new.js");
    expect(await service.save("3", "C:/q.js", "q.js", true)).toBe("C:/new.js");
    expect(disk["C:/new.js"]).toBe("3");
    expect(asked).toEqual(["test.js", "q.js"]);
  });

  it("writes nothing when save is cancelled", async () => {
    const { files, disk } = fakeFiles(null);
    expect(await createScriptFileService(files).save("x", null, "t")).toBeNull();
    expect(Object.keys(disk)).toEqual(["C:/q.js"]);
  });

  it("suggests a .js name from the tab title", () => {
    expect(suggestedScriptName("test")).toBe("test.js");
    expect(suggestedScriptName("Q.JS")).toBe("Q.JS");
  });
});
