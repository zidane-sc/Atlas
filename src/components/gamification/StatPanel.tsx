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
        fontSize: "24px",
        color: `var(${colorVar})`,
        textShadow: value > 0 ? `0 0 8px color-mix(in srgb, var(${colorVar}) 40%, transparent)` : "none",
      }
    : { fontFamily: "var(--font-press-start), monospace", fontSize: "24px" };
  const content = (
    <>
      <div style={style}>
        {shape && <span className="mr-1">{shape}</span>}
        {value}
      </div>
      <div className="mt-2 text-sm tracking-widest text-muted-foreground uppercase">{label}</div>
    </>
  );
  const className = "block border-2 border-border bg-card p-4 text-left transition-all hover:brightness-110";
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
