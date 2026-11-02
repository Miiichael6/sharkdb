import { describe, expect, it, vi } from "vitest";
import type { AvailableUpdate, UpdateStatus } from "../domain/update";
import type { UpdateGateway } from "./ports";
import { createUpdateService } from "./updateService";

const NEWER: AvailableUpdate = { version: "0.2.0", notes: "Novedades" };

/** A gateway that answers `check` with `found` (or rejects with it) and downloads in `chunks` of a known total. */
function fakeGateway(found: AvailableUpdate | null | Error, chunks: number[] = []) {
  const total = chunks.reduce((sum, c) => sum + c, 0);
  const gateway: UpdateGateway = {
    check: vi.fn(async () => {
      if (found instanceof Error) throw found;
      return found;
    }),
    install: vi.fn(async (onProgress) => {
      let downloaded = 0;
      for (const chunk of chunks) onProgress((downloaded += chunk), total);
    }),
    restart: vi.fn(async () => {}),
  };
  return gateway;
}

/** Every status the service goes through, in order. */
function recorded(service: ReturnType<typeof createUpdateService>) {
  const seen: UpdateStatus[] = [];
  service.subscribe((s) => seen.push(s));
  return seen;
}

describe("updateService", () => {
  it("shows a newer version once a check finds it", async () => {
    const service = createUpdateService(fakeGateway(NEWER));
    const seen = recorded(service);
    await service.checkNow();
    expect(seen.map((s) => s.kind)).toEqual(["checking", "available"]);
    expect(service.current()).toEqual({ kind: "available", ...NEWER });
  });

  it("says it is up to date when there is no newer version", async () => {
    const service = createUpdateService(fakeGateway(null));
    await service.checkNow();
    expect(service.current()).toEqual({ kind: "upToDate" });
  });

  it("shows a network error when the user asked, and hides it at startup", async () => {
    const offline = () => fakeGateway(new Error("error sending request"));
    const asked = createUpdateService(offline());
    await asked.checkNow();
    expect(asked.current()).toEqual({ kind: "error", message: "error sending request" });

    const atStartup = createUpdateService(offline());
    await atStartup.checkOnStartup();
    expect(atStartup.current()).toEqual({ kind: "idle" });
  });

  it("does not start a second check while one is running", async () => {
    const gateway = fakeGateway(null);
    const service = createUpdateService(gateway);
    await Promise.all([service.checkNow(), service.checkNow()]);
    expect(gateway.check).toHaveBeenCalledTimes(1);
  });

  it("reports the download progress, then restarts on the new version", async () => {
    const gateway = fakeGateway(NEWER, [25, 25, 50]);
    const service = createUpdateService(gateway);
    await service.checkNow();
    const seen = recorded(service);
    await service.install();
    expect(seen.map((s) => (s.kind === "downloading" ? s.percent : s.kind))).toEqual([null, 25, 50, 100]);
    expect(gateway.restart).toHaveBeenCalledOnce();
  });

  it("shows an install error and does not restart", async () => {
    const gateway = fakeGateway(NEWER);
    gateway.install = vi.fn(async () => {
      throw "invalid signature";
    });
    const service = createUpdateService(gateway);
    await service.checkNow();
    await service.install();
    expect(service.current()).toEqual({ kind: "error", message: "invalid signature" });
    expect(gateway.restart).not.toHaveBeenCalled();
  });

  it("installs nothing until a newer version is found", async () => {
    const gateway = fakeGateway(null);
    const service = createUpdateService(gateway);
    await service.install();
    expect(gateway.install).not.toHaveBeenCalled();
  });
});
