export function PixelLoading({ text = "LOADING REALM..." }: { text?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-8 select-none">
      <div className="flex flex-col items-center gap-3">
        <span className="text-3xl animate-bounce">⚔️</span>
        <div
          className="font-display text-[10px] uppercase tracking-widest animate-pulse"
          style={{ color: "var(--color-primary-gold)" }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}
