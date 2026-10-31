import type { ReactNode } from "react";
import type { BsonType } from "../../domain/bsonValue";

// A short glyph in the type's colour (from `.bson-<type>`): text where a couple of characters say it,
// a drawing where they don't. Numbers, strings, objects and arrays get a tinted box, as in Robo 3T.

const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** A drawing: `paths` in a `w`×`h` box, shown `scale` px per unit. */
const drawing = (w: number, h: number, scale: number, strokeWidth: number, ...paths: string[]) => (
  <svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} aria-hidden>
    {paths.map((d) => (
      <path key={d} d={d} {...stroke} strokeWidth={strokeWidth} />
    ))}
  </svg>
);
/** Square drawing, without a box. */
const icon = (...paths: string[]) => drawing(12, 12, 11 / 12, 1.3, ...paths);
/**
 * Drawing inside a box: symmetric around the middle of a 12×8 field, so it sits centred (text glyphs
 * don't: the font places them on its baseline).
 */
const boxed = (...paths: string[]) => drawing(12, 8, 11 / 12, 1.2, ...paths);

const CALENDAR = icon("M2 3h8v7H2z", "M2 5.5h8", "M4.5 1.5v2", "M7.5 1.5v2");
const CLOCK = icon("M6 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z", "M6 3.5V6l1.8 1.2");
const CHECK = icon("M2.5 6.2 5 8.5l4.5-5");
const BRACES = boxed(
  "M4.5 1H3.8a1 1 0 0 0-1 1v1.2a.8.8 0 0 1-.8.8.8.8 0 0 1 .8.8V6a1 1 0 0 0 1 1h.7",
  "M7.5 1h.7a1 1 0 0 1 1 1v1.2a.8.8 0 0 0 .8.8.8.8 0 0 0-.8.8V6a1 1 0 0 1-1 1h-.7",
);
const BRACKETS = boxed("M4.5 1H3v6h1.5", "M7.5 1H9v6H7.5");
const QUOTES = boxed("M3.5 2.5v3", "M5.2 2.5v3", "M6.8 2.5v3", "M8.5 2.5v3");

const GLYPHS: Record<BsonType, ReactNode> = {
  object: BRACES,
  array: BRACKETS,
  string: QUOTES,
  int32: "i32",
  int64: "i64",
  double: "1.2",
  decimal: "1.2",
  boolean: CHECK,
  date: CALENDAR,
  timestamp: CLOCK,
  objectId: "id",
  null: "null",
  undefined: "–",
  minKey: "min",
  maxKey: "max",
  binary: "01",
  regex: ".*",
  code: "</>",
  symbol: "S",
  dbPointer: "→",
};

const BOXED = new Set<BsonType>(["object", "array", "string", "int32", "int64", "double", "decimal"]);

/** Small badge before each tree key, so BSON types stand apart at a glance. */
export function TypeIcon({ type }: { type: BsonType }) {
  return (
    <span className={`type-icon bson-${type} ${BOXED.has(type) ? "boxed" : ""}`} aria-hidden>
      {GLYPHS[type]}
    </span>
  );
}
