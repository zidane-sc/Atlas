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
  const [tableCols, setTableCols] = useState(3);
  const [tableRows, setTableRows] = useState(3);
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
          <div className="absolute top-full left-0 mt-1 p-3 bg-panel border border-gray-600 z-10">
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-1">
                <label className="text-xs text-foreground">Cols:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-10 px-2 py-1 border border-gray-400 bg-panel text-foreground text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-foreground">Rows:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-10 px-2 py-1 border border-gray-400 bg-panel text-foreground text-xs"
                />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onInsert({
                    before: generateTable(tableCols, tableRows),
                    after: "",
                  });
                  setShowTablePicker(false);
                }}
                className="px-2 py-1 border border-gray-400 bg-panel text-foreground hover:bg-panel-alt text-xs"
              >
                Insert
              </button>
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
