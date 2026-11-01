import { highlightCode } from "@lezer/highlight";
import { StyleModule } from "style-mod";
import { codeHighlight } from "./codeTheme";
import { shellLanguage } from "./shellLanguage";

export interface Token {
  text: string;
  /** Highlight classes; empty for plain text. */
  className: string;
}

let mounted = false;

/**
 * Shell text (a document, a value) split into tokens with the editor's highlight classes, to show it
 * colored outside an editor. Parsed as one expression so a document reads as an object, not a block.
 */
export function highlightShell(code: string): Token[] {
  if (!mounted && codeHighlight.module) {
    StyleModule.mount(document, codeHighlight.module);
    mounted = true;
  }
  const wrapped = `(${code})`;
  const tokens: Token[] = [];
  highlightCode(
    wrapped,
    shellLanguage.parser.parse(wrapped),
    codeHighlight,
    (text, className) => tokens.push({ text, className }),
    () => tokens.push({ text: "\n", className: "" }),
    1,
    wrapped.length - 1,
  );
  return tokens;
}
