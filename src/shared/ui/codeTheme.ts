import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// The code theme: which token gets which role color, with the user's italics (comments, keywords,
// constants, classes and function names are italic; operators and numbers are not). The colors are
// CSS variables (`--syn-*`, one file per theme in app/themes/code-*.css), so switching the code theme
// swaps them without rebuilding editors or highlighted text.
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
  label: "var(--syn-label)",
  variable: "var(--syn-variable)",
  function: "var(--syn-function)",
};

const CONTROL = { height: "26px", margin: 0, boxSizing: "border-box", borderRadius: "5px", fontSize: "12px" };

// Search / replace panel (Ctrl+F) as a grid: find, its buttons, the toggles and close on the first row;
// replace and its buttons below. The checkboxes are hidden, their labels act as toggle buttons.
const searchPanel = {
  ".cm-panel.cm-search": {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 1fr) repeat(7, auto)",
    alignItems: "center",
    gap: "6px",
    padding: "8px 10px",
    fontFamily: "inherit",
  },
  ".cm-panel.cm-search br": { display: "none" },
  ".cm-panel.cm-search .cm-textfield": {
    ...CONTROL,
    padding: "0 8px",
    fontFamily: "inherit",
    color: color.foreground,
    backgroundColor: color.background,
    border: `1px solid ${color.widgetBorder}`,
    outline: "none",
  },
  ".cm-panel.cm-search .cm-textfield:focus": { borderColor: color.variable },
  ".cm-panel.cm-search .cm-button, .cm-panel.cm-search label": {
    ...CONTROL,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 10px",
    color: color.foreground,
    backgroundImage: "none",
    backgroundColor: color.widgetSelected,
    border: `1px solid ${color.widgetBorder}`,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  ".cm-panel.cm-search .cm-button:hover, .cm-panel.cm-search label:hover": { backgroundColor: color.selection },
  ".cm-panel.cm-search label": { color: color.comment, backgroundColor: "transparent" },
  ".cm-panel.cm-search label:has(input:checked)": { color: color.foreground, backgroundColor: color.findMatchHighlight, borderColor: color.variable },
  ".cm-panel.cm-search label:has(input:focus-visible)": { outline: `1px solid ${color.variable}` },
  ".cm-panel.cm-search input[type=checkbox]": { position: "absolute", opacity: 0, width: 0, height: 0, margin: 0 },
  ".cm-panel.cm-search [name=replace]": { gridRow: 2, gridColumn: 1 },
  ".cm-panel.cm-search button[name=replace]": { gridRow: 2, gridColumn: 2 },
  ".cm-panel.cm-search button[name=replaceAll]": { gridRow: 2, gridColumn: "3 / span 2" },
  ".cm-panel.cm-search [name=close]": {
    ...CONTROL,
    position: "static",
    gridRow: 1,
    gridColumn: 8,
    width: "26px",
    padding: 0,
    fontSize: "18px",
    lineHeight: 1,
    color: color.comment,
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
  },
  ".cm-panel.cm-search [name=close]:hover": { color: color.foreground, backgroundColor: color.selection },
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
  ".cm-completionMatchedText": { color: color.label, textDecoration: "none" },
  ".cm-panels": { backgroundColor: color.widget, color: color.foreground },
  ".cm-panels-bottom": { borderTop: `1px solid ${color.widgetBorder}` },
  ...searchPanel,
};

export const codeHighlight = HighlightStyle.define([
  { tag: t.comment, color: color.comment, fontStyle: "italic" },
  { tag: t.string, color: color.string },
  { tag: t.special(t.string), color: color.template },
  { tag: t.regexp, color: color.template },
  { tag: t.number, color: color.constant },
  { tag: [t.bool, t.null, t.atom], color: color.constant, fontStyle: "italic" },
  { tag: t.keyword, color: color.keyword, fontStyle: "italic" },
  { tag: t.operator, color: color.keyword },
  // The dot of `db.coll.find` is an operator too; in red it reads like an error.
  { tag: t.derefOperator, color: color.foreground },
  { tag: t.self, color: color.keyword, fontStyle: "italic" },
  { tag: t.variableName, color: color.variable },
  { tag: t.propertyName, color: color.foreground },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: color.function, fontStyle: "italic" },
  { tag: [t.className, t.typeName], color: color.variable, fontStyle: "italic" },
  { tag: t.definition(t.variableName), color: color.foreground },
  { tag: t.labelName, color: color.label },
  { tag: t.invalid, color: color.keyword, textDecoration: "underline" },
]);

/** The editor theme, in whatever code theme the page has (`data-code-theme`). */
export const codeTheme = [EditorView.theme(spec), syntaxHighlighting(codeHighlight)];
