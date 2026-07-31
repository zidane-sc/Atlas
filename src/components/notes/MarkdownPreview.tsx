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
            <h1 style={{ fontSize: "1.8em", fontWeight: "bold", marginBottom: "0.5em", marginTop: "0.5em" }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: "1.5em", fontWeight: "bold", marginBottom: "0.4em", marginTop: "0.4em" }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: "1.2em", fontWeight: "bold", marginBottom: "0.3em", marginTop: "0.3em" }}>
              {children}
            </h3>
          ),
          code: ({ children }) => (
            <code style={{
              backgroundColor: "var(--color-bg-panel-alt)",
              padding: "2px 6px",
              borderRadius: "3px",
              fontFamily: "monospace",
              fontSize: "0.9em",
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
              marginTop: "1em",
              border: "1px solid var(--color-border)",
            }}>
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul style={{ marginLeft: "2em", marginBottom: "1em", marginTop: "0.5em", listStyleType: "disc" }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{ marginLeft: "2em", marginBottom: "1em", marginTop: "0.5em", listStyleType: "decimal" }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li style={{ marginBottom: "0.3em" }}>
              {children}
            </li>
          ),
          a: ({ children, href }) => (
            <a href={href} style={{ color: "#0066cc", textDecoration: "underline", cursor: "pointer" }}>
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote style={{
              borderLeft: "3px solid var(--color-border)",
              paddingLeft: "1em",
              marginLeft: 0,
              marginBottom: "1em",
              color: "var(--color-text-muted)",
              fontStyle: "italic",
            }}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "1em", marginTop: "1em", border: "1px solid var(--color-border)" }}>
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th style={{
              border: "1px solid var(--color-border)",
              padding: "0.5em",
              backgroundColor: "var(--color-bg-panel-alt)",
              textAlign: "left",
              fontWeight: "bold",
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
