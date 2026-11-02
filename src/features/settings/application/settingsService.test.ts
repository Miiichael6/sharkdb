import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "../domain/settings";
import type { SettingsStore } from "./ports";
import { createSettingsService } from "./settingsService";

/** A store in memory that tells its watchers about each save, as the real one does across windows. */
function fakeStore(saved: unknown = undefined) {
  let stored = saved;
  const watchers = new Set<(settings: unknown) => void>();
  const store: SettingsStore = {
    load: async () => stored,
    save: async (settings) => {
      stored = settings;
      watchers.forEach((w) => w(settings));
    },
    watch: async (listener) => {
      watchers.add(listener);
      return () => watchers.delete(listener);
    },
  };
  return {
    store,
    stored: () => stored,
    emit: (raw: unknown) => watchers.forEach((w) => w(raw)),
  };
}

const custom: Settings = {
  defaultView: "text",
  dateZone: "local",
  pageSize: 100,
  timeoutSeconds: 120,
};

describe("settingsService", () => {
  it("uses the defaults until started, then the saved preferences", async () => {
    const service = createSettingsService(fakeStore(custom).store);
    expect(service.current()).toEqual(DEFAULT_SETTINGS);
    await service.start();
    expect(service.current()).toEqual(custom);
  });

  it("follows what another window saves and tells its subscribers", async () => {
    const fake = fakeStore();
    const service = createSettingsService(fake.store);
    await service.start();
    const listener = vi.fn();
    service.subscribe(listener);
    fake.emit(custom);
    expect(service.current()).toEqual(custom);
    expect(listener).toHaveBeenCalledWith(custom);
  });

  it("saves only valid values", async () => {
    const fake = fakeStore();
    const service = createSettingsService(fake.store);
    await service.save({ ...custom, pageSize: -5 });
    expect(fake.stored()).toEqual({ ...custom, pageSize: 1 });
  });

  it("stops telling a subscriber once it unsubscribes", async () => {
    const fake = fakeStore();
    const service = createSettingsService(fake.store);
    await service.start();
    const listener = vi.fn();
    service.subscribe(listener)();
    fake.emit(custom);
    expect(listener).not.toHaveBeenCalled();
  });
});
