import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// Monokai Vibrant (VS Code), with the user's italics: comments, keywords, constants, classes and
// function names are italic; operators and numbers are not. The colors are CSS variables (`--syn-*`
// in App.css), so the light theme swaps them without rebuilding editors or highlighted text.
const color = {
  background: "var(--syn-background)",
  foreground: "var(--syn-foreground)",
  lineHighlight: "var(--syn-line-highlight)",
  selection: "var(--syn-selection)",
  gutter: "var(--syn-gutter)",
  widget: "var(--syn-widget)",
  widgetBorder: "var(--syn-widget-border)",
  widgetSelected: "var(--syn-widget-selected)",
  findMatch: "var(--syn-find-match)",
  findMatchHighlight: "var(--syn-find-match-highlight)",
  comment: "var(--syn-comment)",
  string: "var(--syn-string)",
  template: "var(--syn-template)",
  constant: "var(--syn-constant)",
  keyword: "var(--syn-keyword)",
  cyan: "var(--syn-cyan)",
  blue: "var(--syn-blue)",
  green: "var(--syn-green)",
};

const spec = {
  "&": { color: color.foreground, backgroundColor: color.background },
  ".cm-content": { caretColor: color.foreground },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: color.foreground },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: color.selection },
  ".cm-activeLine": { backgroundColor: color.lineHighlight },
  ".cm-gutters": { backgroundColor: color.background, color: color.gutter, border: "none" },
  ".cm-activeLineGutter": { backgroundColor: color.lineHighlight, color: color.foreground },
  ".cm-searchMatch": { backgroundColor: color.findMatchHighlight },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: color.findMatch },
  ".cm-selectionMatch": { backgroundColor: color.findMatchHighlight },
  "&.cm-focused .cm-matchingBracket": { backgroundColor: color.selection, outline: `1px solid ${color.gutter}` },
  ".cm-foldPlaceholder": { backgroundColor: "transparent", border: "none", color: color.comment },
  ".cm-tooltip": { backgroundColor: color.widget, border: `1px solid ${color.widgetBorder}`, color: color.foreground },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: color.widgetSelected, color: color.foreground },
  ".cm-completionMatchedText": { color: color.cyan, textDecoration: "none" },
  ".cm-panels": { backgroundColor: color.widget, color: color.foreground },
};

export const monokaiHighlight = HighlightStyle.define([
  { tag: t.comment, color: color.comment, fontStyle: "italic" },
  { tag: t.string, color: color.string },
  { tag: t.special(t.string), color: color.template },
  { tag: t.regexp, color: color.template },
  { tag: t.number, color: color.constant },
  { tag: [t.bool, t.null, t.atom], color: color.constant, fontStyle: "italic" },
  { tag: t.keyword, color: color.keyword, fontStyle: "italic" },
  { tag: t.operator, color: color.keyword },
  { tag: t.self, color: color.keyword, fontStyle: "italic" },
  { tag: t.variableName, color: color.blue },
  { tag: t.propertyName, color: color.foreground },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: color.green, fontStyle: "italic" },
  { tag: [t.className, t.typeName], color: color.blue, fontStyle: "italic" },
  { tag: t.definition(t.variableName), color: color.foreground },
  { tag: t.labelName, color: color.cyan },
  { tag: t.invalid, color: color.keyword, textDecoration: "underline" },
]);

/** The editor theme; `dark` picks CodeMirror's base styles (search fields, buttons…) to match. */
export const monokaiVibrant = (dark: boolean) => [EditorView.theme(spec, { dark }), syntaxHighlighting(monokaiHighlight)];
