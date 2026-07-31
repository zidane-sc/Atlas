"use client";

import { useState } from "react";

interface MarkdownToolbarProps {
  onInsert: (syntax: { before: string; after: string } | string, isBlock?: boolean) => void;
}

const handleButtonClick = (e: React.MouseEvent, callback: () => void) => {
  e.preventDefault();
  e.stopPropagation();
  callback();
};

const generateTable = (cols: number, rows: number) => {
  const header = Array.from({ length: cols }, (_, i) => `Col${i + 1}`).join(" | ");
  const separator = Array.from({ length: cols }, () => "---").join("|");
  const dataRows = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => " ").join(" | ")
  ).join("\n");
  return `| ${header} |\n|${separator}|\n| ${dataRows} |`;
};

export function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  const [showTablePicker, setShowTablePicker] = useState(false);
  const buttonClass =
    "px-2 py-1 border-2 border-gray-400 bg-panel text-foreground hover:bg-panel-alt active:border-primary-gold active:text-primary-gold text-xs font-display transition-colors";

  return (
    <div className="flex gap-1 flex-wrap p-2 border-b border-gray-600 bg-panel">
      {/* Text Formatting */}
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "**", after: "**" }))}
        className={buttonClass}
        title="Bold"
      >
        B
      </button>
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "*", after: "*" }))}
        className={buttonClass}
        title="Italic"
      >
        I
      </button>
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "~~", after: "~~" }))}
        className={buttonClass}
        title="Strikethrough"
      >
        S
      </button>
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "`", after: "`" }))}
        className={buttonClass}
        title="Inline Code"
      >
        `
      </button>

      {/* Divider */}
      <div className="w-px bg-primary-gold opacity-50" />

      {/* Structure */}
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "# ", after: "" }, true))}
        className={buttonClass}
        title="Heading 1"
      >
        H1
      </button>
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "## ", after: "" }, true))}
        className={buttonClass}
        title="Heading 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "### ", after: "" }, true))}
        className={buttonClass}
        title="Heading 3"
      >
        H3
      </button>
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "> ", after: "" }, true))}
        className={buttonClass}
        title="Quote"
      >
        "
      </button>

      {/* Divider */}
      <div className="w-px bg-primary-gold opacity-50" />

      {/* Lists & Checkboxes */}
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "- ", after: "" }, true))}
        className={buttonClass}
        title="Bullet List"
      >
        •
      </button>
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "1. ", after: "" }, true))}
        className={buttonClass}
        title="Numbered List"
      >
        1.
      </button>
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "- [ ] ", after: "" }, true))}
        className={buttonClass}
        title="Checkbox"
      >
        ✓
      </button>

      {/* Divider */}
      <div className="w-px bg-primary-gold opacity-50" />

      {/* Advanced */}
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert({ before: "[", after: "](url)" }))}
        className={buttonClass}
        title="Link"
      >
        🔗
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowTablePicker(!showTablePicker);
          }}
          className={buttonClass}
          title="Table (click to choose size)"
        >
          ▦
        </button>
        {showTablePicker && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-panel border border-gray-600 z-10">
            <div className="text-xs mb-2 text-foreground">Columns × Rows:</div>
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 5 }, (_, c) =>
                Array.from({ length: 5 }, (_, r) => (
                  <button
                    key={`${c + 1}x${r + 1}`}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onInsert({
                        before: generateTable(c + 1, r + 1),
                        after: "",
                      });
                      setShowTablePicker(false);
                    }}
                    className="w-6 h-6 border border-gray-400 bg-panel text-xs text-foreground hover:bg-panel-alt"
                    title={`${c + 1}×${r + 1}`}
                  >
                    {c + 1}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => handleButtonClick(e, () => onInsert("---"))}
        className={buttonClass}
        title="Horizontal Line"
      >
        —
      </button>

    </div>
  );
}
