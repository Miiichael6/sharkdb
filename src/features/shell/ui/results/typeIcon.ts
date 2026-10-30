import type { BsonType } from "../../domain/bsonValue";

/** Glyph before each tree key, so BSON types stand apart at a glance (colour comes from `.bson-<type>`). */
export const TYPE_ICON: Record<BsonType, string> = {
  objectId: "id",
  date: "◷",
  int32: "#",
  int64: "#",
  double: "#",
  decimal: "#",
  string: "“”",
  boolean: "◐",
  null: "∅",
  undefined: "∅",
  minKey: "↓",
  maxKey: "↑",
  binary: "01",
  regex: ".*",
  timestamp: "◷",
  code: "ƒ",
  symbol: "§",
  dbPointer: "→",
  object: "{}",
  array: "[]",
};
