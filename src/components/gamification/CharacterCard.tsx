interface CharacterCardProps {
  name: string;
  class: string;
  level: number;
  avatar: string;
}

export function CharacterCard({ name, class: charClass, level, avatar }: CharacterCardProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-24">
      <div
        className="relative flex items-center justify-center bg-card"
        style={{
          width: 64,
          height: 64,
          border: "2px solid var(--color-primary-gold)",
          fontSize: "32px",
          boxShadow: "0 0 12px rgba(240,180,41,0.2)",
        }}
      >
        {avatar}
      </div>
      <div className="absolute text-center mt-16">
        <div className="font-display text-[9px] text-foreground leading-tight">{name}</div>
        <div className="font-display text-[7px] leading-tight" style={{ color: "var(--color-primary-gold)" }}>
          {charClass}
        </div>
      </div>
      <div
        className="mt-2 font-display text-[7px]"
        style={{
          color: "var(--color-bg-deep)",
          backgroundColor: "var(--color-primary-gold)",
          padding: "2px 6px",
        }}
      >
        LV.{level}
      </div>
    </div>
  );
}
