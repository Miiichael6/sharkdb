import type { BsonType } from "../../domain/bsonValue";

// Lucide-style strokes (24×24) for each BSON type; colour comes from `.bson-<type>`.
const HASH = ["M4 9h16", "M4 15h16", "M10 3 8 21", "M16 3l-2 18"];
const CLOCK = ["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"];
const NONE = ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", "m5.6 5.6 12.8 12.8"];

const PATHS: Record<BsonType, string[]> = {
  object: [
    "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1",
    "M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1",
  ],
  array: ["M8 3H5v18h3", "M16 3h3v18h-3"],
  // Two pairs of quote marks, like Robo 3T's "".
  string: ["M7 7 6 13", "M11 7l-1 6", "M14 7l-1 6", "M18 7l-1 6"],
  int32: HASH,
  int64: HASH,
  double: HASH,
  decimal: HASH,
  boolean: ["M8 6h8a6 6 0 0 1 0 12H8A6 6 0 0 1 8 6Z", "M10 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"],
  date: ["M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z", "M16 3v4", "M8 3v4", "M3 11h18"],
  timestamp: CLOCK,
  objectId: ["M12.5 15.5a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z", "m11 12 9.5-9.5", "m15.5 7.5 3 3L22 7l-3-3"],
  null: NONE,
  undefined: NONE,
  minKey: ["M12 3v14", "m6 11 6 6 6-6", "M5 21h14"],
  maxKey: ["M5 3h14", "m6 13 6-6 6 6", "M12 7v14"],
  binary: ["M6 4h4v6H6z", "M14 14h4v6h-4z", "M6 14h2v6", "M14 4h2v6", "M6 20h4", "M14 10h4"],
  regex: ["M17 3v10", "m12.7 5.5 8.6 5", "m12.7 10.5 8.6-5", "M5 15h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z"],
  code: ["m16 18 6-6-6-6", "m8 6-6 6 6 6"],
  symbol: ["M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z", "M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"],
  dbPointer: [
    "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7",
    "M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  ],
};

/** Small icon before each tree key, so BSON types stand apart at a glance. */
export function TypeIcon({ type }: { type: BsonType }) {
  return (
    <svg
      className={`type-icon bson-${type}`}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[type].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
