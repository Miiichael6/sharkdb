const INT32_MIN = -(2 ** 31);
const INT32_MAX = 2 ** 31 - 1;

/** Characters after which a `/` starts a regex literal rather than a division. */
const BEFORE_REGEX = new Set(["", ":", "[", ",", "(", "{", "=", "!", "&", "|", "?"]);

const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
const isWordChar = (c: string | undefined) => c !== undefined && /[\w$.]/.test(c);

/** Index just past the string or template literal opening at `start`. */
function skipString(text: string, start: number): number {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length && text[i] !== quote) i += text[i] === "\\" ? 2 : 1;
  return i + 1;
}

/** Index just past the regex literal opening at `start` (a `/` inside a class `[…]` doesn't close it). */
function skipRegex(text: string, start: number): number {
  let i = start + 1;
  let inClass = false;
  while (i < text.length && text[i] !== "\n") {
    const c = text[i];
    if (c === "\\") i++;
    else if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) break;
    i++;
  }
  i++;
  while (/[a-z]/i.test(text[i] ?? "")) i++;
  return i;
}

/**
 * Wraps the plain integer values of a document's text in `NumberInt(…)`, so that evaluating it keeps
 * them Int32 as Robo 3T does (in JavaScript `1` is a double). Only literals standing as a value of an
 * object or an array element are touched, never inside calls, strings, regexes or comments; numbers
 * with a decimal point or an exponent, and integers outside the Int32 range, stay doubles.
 */
export function markIntegers(text: string): string {
  let out = "";
  let copied = 0;
  // Open brackets, to tell a value from an object key or a call argument.
  const stack: string[] = [];
  // Last significant character seen, "" at the start.
  let prev = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(text, i);
      prev = c;
    } else if (c === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      i = end < 0 ? text.length : end;
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 2;
    } else if (c === "/" && BEFORE_REGEX.has(prev)) {
      i = skipRegex(text, i);
      prev = "/";
    } else if (/\s/.test(c)) {
      i++;
    } else if ((isDigit(c) || (c === "-" && isDigit(text[i + 1]))) && !isWordChar(text[i - 1])) {
      let end = c === "-" ? i + 1 : i;
      while (isDigit(text[end])) end++;
      const top = stack[stack.length - 1];
      const isValue = (top === "{" && prev === ":") || (top === "[" && (prev === "[" || prev === ","));
      const literal = text.slice(i, end);
      const value = Number(literal);
      if (isValue && !isWordChar(text[end]) && !/^-?0\d/.test(literal) && value >= INT32_MIN && value <= INT32_MAX) {
        out += `${text.slice(copied, i)}NumberInt(${literal})`;
        copied = end;
      }
      while (isWordChar(text[end])) end++;
      i = end;
      prev = "0";
    } else {
      if (c === "{" || c === "[" || c === "(") stack.push(c);
      else if (c === "}" || c === "]" || c === ")") stack.pop();
      prev = c;
      i++;
    }
  }
  return out + text.slice(copied);
}
