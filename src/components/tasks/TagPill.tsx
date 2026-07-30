export function TagPill({ tag }: { tag: string }) {
  return (
    <span
      className="inline-block border px-1.5 text-sm whitespace-nowrap text-muted-foreground"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      #{tag}
    </span>
  );
}
