import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// Monokai Vibrant (VS Code), with the user's italics: comments, keywords, constants, classes and
// function names are italic; operators and numbers are not.
const color = {
  background: "#16171D",
  foreground: "#f8f8f0",
  lineHighlight: "#1F2328",
  selection: "#3E4451",
  gutter: "#495162",
  widget: "#21252B",
  widgetBorder: "#181A1F",
  widgetSelected: "#2c313a",
  findMatch: "#42557B",
  findMatchHighlight: "#314365",
  comment: "#5c6370",
  string: "#FFD945",
  template: "#E5A422",
  constant: "#E373CE",
  keyword: "#FF3F4F",
  cyan: "#19D1E5",
  blue: "#00a0e4",
  green: "#81F900",
};

const theme = EditorView.theme(
  {
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
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
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

export const monokaiVibrant = [theme, syntaxHighlighting(highlight)];
