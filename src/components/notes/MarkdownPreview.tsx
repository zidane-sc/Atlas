"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="prose prose-invert max-w-none p-4 overflow-y-auto h-full" style={{
      fontSize: "15px",
      lineHeight: "1.6",
      color: "var(--color-foreground)",
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 style={{ color: "var(--color-primary-gold)", marginBottom: "1em" }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ color: "var(--color-primary-gold)", marginBottom: "0.8em" }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ color: "var(--color-primary-gold)", marginBottom: "0.6em" }}>
              {children}
            </h3>
          ),
          code: ({ children }) => (
            <code style={{
              backgroundColor: "var(--color-bg-panel-alt)",
              padding: "2px 6px",
              borderRadius: "3px",
              fontFamily: "monospace",
            }}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre style={{
              backgroundColor: "var(--color-bg-panel-alt)",
              padding: "1em",
              borderRadius: "4px",
              overflow: "auto",
              marginBottom: "1em",
            }}>
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote style={{
              borderLeft: "3px solid var(--color-primary-gold)",
              paddingLeft: "1em",
              marginLeft: 0,
              color: "var(--color-text-muted)",
              fontStyle: "italic",
            }}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "1em" }}>
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th style={{
              border: "1px solid var(--color-border)",
              padding: "0.5em",
              backgroundColor: "var(--color-bg-panel-alt)",
              textAlign: "left",
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{
              border: "1px solid var(--color-border)",
              padding: "0.5em",
            }}>
              {children}
            </td>
          ),
        }}
      >
        {content || "(Preview renders here)"}
      </ReactMarkdown>
    </div>
  );
}
