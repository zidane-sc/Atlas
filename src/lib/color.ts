/**
 * A project's `colorVar` is either a CSS custom-property name (e.g. "--color-status-ready")
 * or, when the user picks a custom color, a literal value (e.g. "#f0b429") — ProjectFormSheet
 * writes the literal into both `customColor` and `colorVar`. Wrapping a literal in `var()`
 * produces invalid CSS that the browser silently drops, so callers must resolve through this
 * instead of interpolating `colorVar` into `var(${colorVar})` directly.
 */
export function resolveColorVar(colorVar: string): string {
  return colorVar.startsWith("--") ? `var(${colorVar})` : colorVar;
}
