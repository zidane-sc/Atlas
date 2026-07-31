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
      <div className="border-2 border-dashed border-border py-8 text-center">
        <div className="text-2xl mb-2">{icon}</div>
        <p className="text-sm font-medium" style={{ color: "var(--color-dim)" }}>
          {message}
        </p>
        {subtext && <p className="text-xs mt-1 text-muted-foreground">{subtext}</p>}
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
