import { describe, expect, it } from "vitest";
import { addNotification, badgeText, markAllRead, newestFirst, unreadCount, type AppNotification } from "./notifications";

const add = (list: AppNotification[], text: string, limit?: number) =>
  addNotification(list, { level: "ok", text, at: 0 }, limit);

describe("notifications", () => {
  it("adds unread entries with increasing ids, bounded by the limit", () => {
    let list = add([], "a");
    list = add(list, "b");
    expect(list.map((n) => [n.id, n.text, n.read])).toEqual([
      [1, "a", false],
      [2, "b", false],
    ]);
    list = add(list, "c", 2);
    expect(list.map((n) => n.id)).toEqual([2, 3]);
  });

  it("counts unread and marks everything read", () => {
    const list = add(add([], "a"), "b");
    expect(unreadCount(list)).toBe(2);
    const read = markAllRead(list);
    expect(unreadCount(read)).toBe(0);
    expect(markAllRead(read)).toBe(read);
  });

  it("lists newest first without touching the history", () => {
    const list = add(add([], "a"), "b");
    expect(newestFirst(list).map((n) => n.text)).toEqual(["b", "a"]);
    expect(list.map((n) => n.text)).toEqual(["a", "b"]);
  });

  it("caps the badge text", () => {
    expect(badgeText(7)).toBe("7");
    expect(badgeText(150)).toBe("99+");
  });
});
