"use client";

interface MarkdownToolbarProps {
  onInsert: (syntax: { before: string; after: string } | string, isBlock?: boolean) => void;
}

export function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  const buttonClass =
    "px-2 py-1 border-2 border-gray-400 bg-panel text-foreground hover:bg-panel-alt active:border-primary-gold active:text-primary-gold text-xs font-display transition-colors";

  return (
    <div className="flex gap-1 flex-wrap p-2 border-b border-gray-600 bg-panel">
      {/* Text Formatting */}
      <button
        onClick={() => onInsert({ before: "**", after: "**" })}
        className={buttonClass}
        title="Bold"
      >
        B
      </button>
      <button
        onClick={() => onInsert({ before: "*", after: "*" })}
        className={buttonClass}
        title="Italic"
      >
        I
      </button>
      <button
        onClick={() => onInsert({ before: "~~", after: "~~" })}
        className={buttonClass}
        title="Strikethrough"
      >
        S
      </button>
      <button
        onClick={() => onInsert({ before: "`", after: "`" })}
        className={buttonClass}
        title="Inline Code"
      >
        `
      </button>

      {/* Divider */}
      <div className="w-px bg-primary-gold opacity-50" />

      {/* Structure */}
      <button
        onClick={() => onInsert({ before: "# ", after: "" }, true)}
        className={buttonClass}
        title="Heading 1"
      >
        H1
      </button>
      <button
        onClick={() => onInsert({ before: "## ", after: "" }, true)}
        className={buttonClass}
        title="Heading 2"
      >
        H2
      </button>
      <button
        onClick={() => onInsert({ before: "### ", after: "" }, true)}
        className={buttonClass}
        title="Heading 3"
      >
        H3
      </button>
      <button
        onClick={() => onInsert({ before: "> ", after: "" }, true)}
        className={buttonClass}
        title="Quote"
      >
        "
      </button>

      {/* Divider */}
      <div className="w-px bg-primary-gold opacity-50" />

      {/* Lists & Checkboxes */}
      <button
        onClick={() => onInsert({ before: "- ", after: "" }, true)}
        className={buttonClass}
        title="Bullet List"
      >
        •
      </button>
      <button
        onClick={() => onInsert({ before: "1. ", after: "" }, true)}
        className={buttonClass}
        title="Numbered List"
      >
        1.
      </button>
      <button
        onClick={() => onInsert({ before: "- [ ] ", after: "" }, true)}
        className={buttonClass}
        title="Checkbox"
      >
        ✓
      </button>

      {/* Divider */}
      <div className="w-px bg-primary-gold opacity-50" />

      {/* Advanced */}
      <button
        onClick={() => onInsert({ before: "[", after: "](url)" })}
        className={buttonClass}
        title="Link"
      >
        🔗
      </button>
      <button
        onClick={() =>
          onInsert({
            before: "| Col1 | Col2 |\n|------|------|\n| A    | B    |",
            after: "",
          })
        }
        className={buttonClass}
        title="Table"
      >
        ▦
      </button>
      <button
        onClick={() => onInsert("---")}
        className={buttonClass}
        title="Horizontal Line"
      >
        —
      </button>

    </div>
  );
}
