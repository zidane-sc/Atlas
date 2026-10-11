interface EmptyStateProps {
  icon?: string;
  message?: string;
  subtext?: string;
  variant?: "default" | "compact" | "dashed";
}

export function EmptyState({
  icon = "📭",
  message = "Nothing here",
  subtext,
  variant = "default",
}: EmptyStateProps) {
  if (variant === "compact") {
    return (
      <p className="py-3 text-center text-sm text-muted-foreground">
        {icon} {message}
      </p>
    );
  }

  if (variant === "dashed") {
    return (
      <div className="parchment-empty py-7 px-3 text-center transition-all select-none">
        <div className="text-xl mb-1 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{icon}</div>
        <p className="text-xs font-mono font-bold tracking-wider uppercase text-[var(--color-primary-gold)]">
          {message}
        </p>
        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
          {subtext || "No active quests in this slot"}
        </p>
      </div>
    );
  }

  return (
    <div className="py-12 text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {subtext && <p className="text-xs mt-2 text-muted-foreground">{subtext}</p>}
    </div>
  );
}
