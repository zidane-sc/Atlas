"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];
type ButtonSize = React.ComponentProps<typeof Button>["size"];

/**
 * Inline two-step confirm — replaces window.confirm() so destructive actions stay non-blocking
 * (product rule: avoid modal dialogs unless absolutely necessary) while still requiring a
 * deliberate second click. Auto-disarms after 4s so an accidental first click can't linger.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Confirm?",
  title,
  variant = "ghost",
  size = "icon-sm",
}: {
  onConfirm: () => void;
  children: React.ReactNode;
  confirmLabel?: string;
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button
          type="button"
          variant="destructive"
          size={size === "icon-sm" || size === "icon-xs" || size === "icon-lg" || size === "icon" ? "sm" : size}
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={size === "icon-sm" || size === "icon-xs" || size === "icon-lg" || size === "icon" ? "sm" : size}
          onClick={() => setArmed(false)}
        >
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <Button type="button" variant={variant} size={size} title={title} onClick={() => setArmed(true)}>
      {children}
    </Button>
  );
}
