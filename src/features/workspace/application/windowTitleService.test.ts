import { describe, expect, it } from "vitest";
import { APP_TITLE } from "../domain/windowTitle";
import type { WindowGateway } from "./ports";
import { createWindowTitleService } from "./windowTitleService";

function fakeGateway() {
  const titles: string[] = [];
  const gateway: WindowGateway = {
    setTitle: async (title) => {
      titles.push(title);
    },
  };
  return { gateway, titles };
}

describe("windowTitleService", () => {
  it("titles the window with the active connection, or the app name alone", async () => {
    const { gateway, titles } = fakeGateway();
    const service = createWindowTitleService(gateway);
    await service.show({ connection: "QA", tag: "testing" });
    await service.show();
    expect(titles).toEqual(["robo3B · QA · TESTING", APP_TITLE]);
  });
});
