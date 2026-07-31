/**
 * Insert markdown syntax at cursor position.
 * Example: insertMarkdown("hello world", 5, 5, { before: "**", after: "**" })
 * → "hello **world"
 */
export function insertMarkdown(
  text: string,
  cursorStart: number,
  cursorEnd: number,
  syntax: { before: string; after: string }
): { newText: string; newCursorPos: number } {
  const before = text.slice(0, cursorStart);
  const selected = text.slice(cursorStart, cursorEnd);
  const after = text.slice(cursorEnd);

  if (selected) {
    const newText = before + syntax.before + selected + syntax.after + after;
    return {
      newText,
      newCursorPos: cursorStart + syntax.before.length + selected.length + syntax.after.length,
    };
  } else {
    const placeholder = "text";
    const newText = before + syntax.before + placeholder + syntax.after + after;
    return {
      newText,
      newCursorPos: cursorStart + syntax.before.length,
    };
  }
}

/**
 * Insert block syntax (headings, quotes, lists).
 */
export function insertBlock(
  text: string,
  cursorLine: number,
  prefix: string
): { newText: string; newCursorPos: number } {
  const lines = text.split("\n");
  lines[cursorLine] = prefix + (lines[cursorLine] || "");
  return {
    newText: lines.join("\n"),
    newCursorPos: cursorLine === 0 ? prefix.length : text.indexOf("\n", cursorLine) + prefix.length + 1,
  };
}

/**
 * Get current line from text and cursor position.
 */
export function getCurrentLine(
  text: string,
  cursorPos: number
): { line: string; lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf("\n", cursorPos) + 1;
  const lineEnd = text.indexOf("\n", cursorPos);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  return { line, lineStart, lineEnd: lineEnd === -1 ? text.length : lineEnd };
}

/**
 * Markdown syntax definitions.
 */
export const MARKDOWN_SYNTAX = {
  bold: { before: "**", after: "**" },
  italic: { before: "*", after: "*" },
  strikethrough: { before: "~~", after: "~~" },
  code: { before: "`", after: "`" },
  codeBlock: { before: "```\n", after: "\n```" },
  link: { before: "[", after: "](url)" },
  heading1: { prefix: "# " },
  heading2: { prefix: "## " },
  heading3: { prefix: "### " },
  quote: { prefix: "> " },
  bulletList: { prefix: "- " },
  numberedList: { prefix: "1. " },
  checkbox: { prefix: "- [ ] " },
  table: { before: "| Col1 | Col2 |\n|------|------|\n| A    | B    |" },
  horizontalLine: "\n---\n",
};
