import { javascriptLanguage } from "@codemirror/lang-javascript";
import { highlightCode } from "@lezer/highlight";
import { StyleModule } from "style-mod";
import { monokaiHighlight } from "./monokaiVibrant";

export interface Token {
  text: string;
  /** Highlight classes; empty for plain text. */
  className: string;
}

let mounted = false;

/**
 * Shell text (a document, a value) split into tokens with the editor's Monokai Vibrant classes, to show it
 * colored outside an editor. Parsed as one expression so a document reads as an object, not a block.
 */
export function highlightShell(code: string): Token[] {
  if (!mounted && monokaiHighlight.module) {
    StyleModule.mount(document, monokaiHighlight.module);
    mounted = true;
  }
  const wrapped = `(${code})`;
  const tokens: Token[] = [];
  highlightCode(
    wrapped,
    javascriptLanguage.parser.parse(wrapped),
    monokaiHighlight,
    (text, className) => tokens.push({ text, className }),
    () => tokens.push({ text: "\n", className: "" }),
    1,
    wrapped.length - 1,
  );
  return tokens;
}
