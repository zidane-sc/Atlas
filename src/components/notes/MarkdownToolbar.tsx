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
  let table = "";
  const cellPadding = "       "; // 7 spaces per cell

  // Header row
  table += "|";
  for (let i = 0; i < cols; i++) {
    const header = `Col${i + 1}`;
    table += " " + header + cellPadding.slice(header.length + 1) + "|";
  }
  table += "\n";

  // Separator row
  table += "|";
  for (let i = 0; i < cols; i++) {
    table += "-".repeat(cellPadding.length) + "|";
  }
  table += "\n";

  // Data rows
  for (let r = 0; r < rows; r++) {
    table += "|";
    for (let c = 0; c < cols; c++) {
      table += cellPadding + "|";
    }
    if (r < rows - 1) table += "\n";
  }

  return table;
};

export function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableCols, setTableCols] = useState(3);
  const [tableRows, setTableRows] = useState(3);
  const buttonClass =
    "px-1.5 py-1 md:px-2 md:py-1 border-2 border-gray-400 bg-panel text-foreground hover:bg-panel-alt active:border-primary-gold active:text-primary-gold text-[10px] md:text-xs font-display transition-colors";

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
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowTablePicker(false);
              }}
              style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
            />
            <div className="absolute top-full left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 mt-2 p-3 border-2 border-gray-500 rounded-lg z-50 shadow-lg max-w-[calc(100vw-2rem)]" style={{ minWidth: "240px", backgroundColor: "var(--color-bg-panel-alt)" }}>
              <div className="mb-2">
                <div className="text-xs font-display text-foreground mb-2">Create Table</div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground block mb-1">Cols</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={tableCols}
                      onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-1.5 py-1 border border-gray-400 bg-panel text-foreground text-xs rounded"
                      autoFocus
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground block mb-1">Rows</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={tableRows}
                      onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-1.5 py-1 border border-gray-400 bg-panel text-foreground text-xs rounded"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
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
                  className="flex-1 px-2 py-1 border border-green-600 bg-panel text-foreground hover:bg-panel-alt text-xs font-display rounded transition-colors"
                >
                  Insert
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowTablePicker(false);
                  }}
                  className="flex-1 px-2 py-1 border border-gray-400 bg-panel text-foreground hover:bg-panel-alt text-xs font-display rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
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
