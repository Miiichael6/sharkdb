import type { KeyboardEvent, RefObject, SyntheticEvent } from "react";
import { inlineTypeOf } from "../../../documents/domain/inlineEdit";
import type { InlineEditState } from "./useInlineEdit";

const BOOLEAN_OPTIONS = ["true", "false"];

interface Props {
  edit: InlineEditState;
  editorRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<(HTMLInputElement & HTMLSelectElement) | null>;
  onChange: (text: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

/** Keeps the tree's own handlers (pick, drag, menu, arrows, Ctrl+C) away from the editor. */
const isolate = (e: SyntheticEvent) => e.stopPropagation();

/**
 * The value of a tree row as an editable field (R80): a text field for strings and numbers (strings
 * without quotes: what is typed is the value), `true` / `false` for booleans. A value that can't be
 * read as its type is marked, with the reason, and the editor stays open.
 */
export function InlineValueEditor({ edit, editorRef, inputRef, onChange, onCommit, onCancel }: Props) {
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      onCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Tab") {
      // Focus stays in the editor until Enter or Escape closes it.
      e.preventDefault();
    }
  };
  const field = {
    className: `inline-editor-field ${edit.error ? "invalid" : ""}`,
    value: edit.text,
    autoFocus: true,
    "aria-invalid": !!edit.error,
    "aria-label": "Nuevo valor",
    onKeyDown,
  };

  return (
    <div ref={editorRef} className="inline-editor" onMouseDown={isolate} onClick={isolate} onDoubleClick={isolate} onContextMenu={isolate}>
      {inlineTypeOf(edit.raw) === "boolean" ? (
        <select ref={inputRef} {...field} onChange={(e) => onChange(e.target.value)}>
          {BOOLEAN_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input ref={inputRef} {...field} spellCheck={false} onFocus={(e) => e.target.select()} onChange={(e) => onChange(e.target.value)} />
      )}
      {edit.error && (
        <span className="inline-editor-error" role="alert" title={edit.error}>
          {edit.error}
        </span>
      )}
    </div>
  );
}
