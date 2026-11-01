import { useState, type ReactNode } from "react";
import type { DateZone } from "../../domain/bsonFormat";
import { bsonValue } from "../../domain/bsonValue";
import { consoleChildren, rangeItems, rangeLabel, type ConsoleChild } from "../../domain/consoleChildren";
import { previewParts, type PreviewOptions, type PreviewPart } from "../../domain/consolePreview";

/** ▶ that turns ▼ when open; a blank of the same width when there is nothing to open. */
function Twisty({ open, shown }: { open: boolean; shown: boolean }) {
  return (
    <span className={`twisty ${open ? "open" : ""}`} aria-hidden>
      {shown && (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M3 1.5 6.5 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

/** A line that opens to show `children()`, which is only built once it is open. */
function Foldable({ head, children }: { head: ReactNode; children: () => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="console-node">
      <div className="console-head foldable" role="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Twisty open={open} shown />
        {head}
      </div>
      {open && <div className="console-children">{children()}</div>}
    </div>
  );
}

const TONE_CLASS: Record<"key" | "label", string> = { key: "console-key", label: "console-label" };

/** A preview with each piece in its type's color. */
function Preview({ parts }: { parts: PreviewPart[] }) {
  return parts.map((p, i) =>
    p.tone ? (
      <span key={i} className={p.tone === "key" || p.tone === "label" ? TONE_CLASS[p.tone] : `bson-${p.tone}`}>
        {p.text}
      </span>
    ) : (
      p.text
    ),
  );
}

function Key({ name }: { name?: string }) {
  return name === undefined ? null : <span className="console-key">{name}: </span>;
}

/** The rows under an open value; `items` are its elements when it is an array, for its ranges. */
function ChildRows({ rows, items, zone }: { rows: ConsoleChild[]; items: unknown[]; zone: DateZone }) {
  return rows.map((child) =>
    child.kind === "range" ? (
      <Foldable key={child.from} head={<span className="console-key">{rangeLabel(child.from, child.to)}</span>}>
        {() => <ChildRows rows={rangeItems(items, child.from, child.to)} items={items} zone={zone} />}
      </Foldable>
    ) : (
      <ConsoleValue key={child.key} name={child.key} value={child.value} zone={zone} />
    ),
  );
}

interface Props extends PreviewOptions {
  value: unknown;
  zone: DateZone;
  /** Field name or array index, for a value inside another. */
  name?: string;
}

/**
 * A value as the browser console shows it: documents and arrays as a one-line preview that opens level
 * by level (long arrays in ranges of 100), scalars as their literal in their type's color.
 */
export function ConsoleValue({ value, zone, name, label, more }: Props) {
  const v = bsonValue(value);
  const preview = <Preview parts={previewParts(value, zone, { label, more })} />;
  const opens = v.type === "array" ? v.items.length > 0 : v.type === "object" && v.fields.length > 0;
  if (!opens) {
    return (
      <div className="console-head">
        <Twisty open={false} shown={false} />
        <Key name={name} />
        <span className="console-preview">{preview}</span>
      </div>
    );
  }
  return (
    <Foldable
      head={
        <>
          <Key name={name} />
          <span className="console-preview">{preview}</span>
        </>
      }
    >
      {() => <ChildRows rows={consoleChildren(value)} items={v.type === "array" ? v.items : []} zone={zone} />}
    </Foldable>
  );
}
