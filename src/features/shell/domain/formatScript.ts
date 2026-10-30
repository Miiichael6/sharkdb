import beautify from "js-beautify";

const INDENT_SIZE = 2;

/** Pretty-prints a shell script (Ctrl+Shift+F), keeping `use x` / `show dbs` lines untouched. */
export function formatScript(code: string): string {
  return beautify.js(code, {
    indent_size: INDENT_SIZE,
    end_with_newline: false,
    preserve_newlines: true,
    max_preserve_newlines: 2,
    space_in_empty_paren: false,
  });
}
