import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { LanguageSupport } from "@codemirror/language";
import { styleTags, Tag, tags as t } from "@lezer/highlight";

// Finer tags than Lezer's own, so the code theme can tell apart what VS Code's themes color apart.
// Each one falls back to its parent in a highlighter that doesn't know it.
export const shellTags = {
  /** A function's parameter (`variable.parameter`); a modifier, as a modified tag can't be a parent. */
  parameter: Tag.defineModifier("parameter")(t.definition(t.variableName)),
  /** The object a member is read from: `db` in `db.coll` (`variable.other.object`). */
  object: Tag.define(t.variableName),
};

/** JavaScript with the extra tags above: the language of the editors and of highlighted shell text. */
export const shellLanguage = javascriptLanguage.configure({
  props: [
    styleTags({
      "ParamList/VariableDefinition": shellTags.parameter,
      "MemberExpression/VariableName": shellTags.object,
    }),
  ],
});

/** `javascript()` (completion, folding…) over the shell language. */
export const shellJavascript = () => new LanguageSupport(shellLanguage, javascript().support);
