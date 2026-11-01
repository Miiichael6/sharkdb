/** Prefix of the keys saved while the app was called Robo3B. */
const OLD_PREFIX = "robo3b.";
const PREFIX = "sharkdb.";

/** Moves the preferences saved as Robo3B to their SharkDB keys, without overwriting newer ones. */
export function moveRenamedStorage(storage: Storage = localStorage) {
  try {
    const oldKeys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
      (key): key is string => key?.startsWith(OLD_PREFIX) ?? false,
    );
    for (const oldKey of oldKeys) {
      const key = PREFIX + oldKey.slice(OLD_PREFIX.length);
      const value = storage.getItem(oldKey);
      if (storage.getItem(key) === null && value !== null) storage.setItem(key, value);
      storage.removeItem(oldKey);
    }
  } catch {
    // Without storage there's nothing to move.
  }
}
