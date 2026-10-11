import Link from "next/link";

export function StatPanel({
  label,
  value,
  shape,
  colorVar,
  href,
}: {
  label: string;
  value: number;
  shape?: string;
  colorVar?: string;
  href?: string;
}) {
  const style = colorVar
    ? {
        fontFamily: "var(--font-press-start), monospace",
        fontSize: "18px",
        color: `var(${colorVar})`,
        textShadow: value > 0 ? `0 0 8px color-mix(in srgb, var(${colorVar}) 40%, transparent)` : "none",
      }
    : { fontFamily: "var(--font-press-start), monospace", fontSize: "18px" };

  const content = (
    <>
      <div className="flex items-center gap-1.5" style={style}>
        {shape && <span className="text-xs shrink-0">{shape}</span>}
        <span>{value}</span>
      </div>
      <div className="mt-1 text-[11px] tracking-wider text-muted-foreground uppercase font-mono">{label}</div>
    </>
  );

  const className = "block border-2 border-border bg-card p-3 text-left transition-all hover:brightness-110 cursor-pointer";
  const hoverProps = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      if (colorVar) e.currentTarget.style.borderColor = `var(${colorVar})`;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.borderColor = "var(--color-border)";
    },
  };

  return href ? (
    <Link href={href} className={className} {...hoverProps}>{content}</Link>
  ) : (
    <div className={className} {...hoverProps}>{content}</div>
  );
}
