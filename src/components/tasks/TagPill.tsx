export function TagPill({ tag }: { tag: string }) {
  return (
    <span
      className="inline-block border border-border bg-secondary/50 px-1.5 py-0.5 text-xs font-mono whitespace-nowrap text-muted-foreground truncate max-w-[110px]"
      title={`#${tag}`}
    >
      #{tag}
    </span>
  );
}
