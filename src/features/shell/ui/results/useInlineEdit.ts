import { useEffect, useRef, useState } from "react";
import { leaveInlineEditRequest } from "../../../../shared/domain/confirmation";
import { confirmInWindow } from "../../../../shared/ui/confirmInWindow";
import type { StoredDocument } from "../../../../shared/ui/documentActions";
import { useLog } from "../../../../shared/ui/useLog";
import { fieldPath } from "../../../documents/domain/fieldUpdate";
import { inlineEditText, isInlineEditable, isSameValue, parseInlineValue } from "../../../documents/domain/inlineEdit";
import type { TreeRow } from "../../domain/resultView";
import type { InlineEditing } from "./useFieldEdit";

/** Clicks that triple-click opens the editor with (`MouseEvent.detail`). */
export const INLINE_EDIT_CLICKS = 3;

/** Mouse events kept from the rest of the window while a value is being edited (D22). */
const GUARDED_EVENTS = ["pointerdown", "mousedown", "mouseup", "click", "auxclick", "dblclick", "contextmenu"] as const;
/** The event of a click elsewhere that asks whether to leave the editor. */
const ASKING_EVENT = "pointerdown";

/** The value being edited: its row, and the text typed so far. */
export interface InlineEditState {
  rowId: string;
  docIndex: number;
  path: string[];
  raw: unknown;
  text: string;
  /** Why `text` can't be saved (wrong type, out of range), shown without closing the editor. */
  error: string | null;
}

interface PageEdit {
  docs: unknown[];
  edit: InlineEditState | null;
}

/**
 * One value of the tree edited in its row (R79–R84): opened with a triple click, Enter saves after
 * asking (or just closes when the value is the same), Escape cancels. Meanwhile a click anywhere
 * else, or leaving the window, asks before throwing away what was typed; that click does nothing.
 */
export function useInlineEdit(docs: unknown[], editing: InlineEditing | undefined) {
  const log = useLog();
  const [state, setState] = useState<PageEdit>({ docs, edit: null });
  // Another page closes the editor.
  const current = state.docs === docs ? state : { docs, edit: null };
  if (current !== state) setState(current);
  const edit = current.edit;
  const isEditing = edit !== null;

  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null);
  /** A window of ours (confirmation or "Estás editando") is open: nothing else asks meanwhile. */
  const asking = useRef(false);
  const latest = useRef({ edit, docs });
  latest.current = { edit, docs };

  const setEdit = (next: InlineEditState | null) => setState((s) => ({ ...s, edit: next }));

  /** Closes the editor and gives the keyboard back to the tree. */
  const close = () => {
    editorRef.current?.closest<HTMLElement>(".virtual-list")?.focus();
    setEdit(null);
  };
  const refocus = () => inputRef.current?.focus();

  /** Opens `row`'s value, when it is a primitive the session can write. */
  const open = (row: TreeRow) => {
    if (!editing || !isInlineEditable(row.path, row.raw)) return;
    if (editing.blocked) return log.info(editing.blocked);
    setEdit({ rowId: row.id, docIndex: row.docIndex, path: row.path, raw: row.raw, text: inlineEditText(row.raw), error: null });
  };

  const change = (text: string) => edit && setEdit({ ...edit, text, error: null });

  /** Runs `ask` with the rest of the window held off, so one question at a time is asked. */
  const whileAsking = async (ask: () => Promise<void>) => {
    if (asking.current) return;
    asking.current = true;
    try {
      await ask();
    } catch (e) {
      log.error("No se pudo preguntar por la edición en curso", e);
    } finally {
      asking.current = false;
    }
  };

  /** Enter: an equal value closes silently; a changed one is confirmed and written. */
  const commit = () => {
    if (!edit || !editing) return;
    const parsed = parseInlineValue(edit.text, edit.raw);
    if (parsed.error !== null) return setEdit({ ...edit, error: parsed.error });
    if (isSameValue(edit.raw, parsed.value)) return close();
    const doc = latest.current.docs[edit.docIndex] as StoredDocument;
    void whileAsking(async () => {
      const outcome = await editing.save({ doc, path: edit.path, before: edit.raw, after: parsed.value });
      if (outcome === "cancelled") refocus();
      else close();
    });
  };

  // While editing, the rest of the window waits for an answer to "Estás editando el campo…".
  useEffect(() => {
    if (!isEditing) return;
    const askToLeave = () =>
      whileAsking(async () => {
        const field = fieldPath(latest.current.edit?.path ?? []);
        if (await confirmInWindow(leaveInlineEditRequest(field))) close();
        else refocus();
      });
    const guard = (e: Event) => {
      if (editorRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.type === ASKING_EVENT) void askToLeave();
    };
    const onWindowBlur = (e: FocusEvent) => {
      if (e.target === window) void askToLeave();
    };
    GUARDED_EVENTS.forEach((type) => document.addEventListener(type, guard, true));
    window.addEventListener("blur", onWindowBlur);
    return () => {
      GUARDED_EVENTS.forEach((type) => document.removeEventListener(type, guard, true));
      window.removeEventListener("blur", onWindowBlur);
    };
    // Only opening and closing the editor (re)installs the guard; the rest is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  return { edit, open, change, commit, cancel: close, editorRef, inputRef };
}
