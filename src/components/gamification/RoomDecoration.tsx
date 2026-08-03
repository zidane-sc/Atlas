"use client";

import { useState } from "react";
import { useTasks } from "@/components/providers/TasksProvider";
import { DECORATIONS_CATALOG, type DecorationItem } from "@/lib/decorations-catalog";

const CATEGORIES = [
  { id: "desk", label: "Desks" },
  { id: "chair", label: "Chairs" },
  { id: "decor", label: "Decors" },
  { id: "wallpaper", label: "Wallpaper" },
  { id: "floor", label: "Flooring" },
] as const;

// Visual mapping for wallpapers
const WALLPAPER_STYLES: Record<string, { background: string; borderBottom: string }> = {
  "wall-brick": {
    background: "linear-gradient(rgba(19, 22, 29, 0.9), rgba(19, 22, 29, 0.9)), repeating-linear-gradient(0deg, var(--color-border), var(--color-border) 2px, transparent 2px, transparent 20px), repeating-linear-gradient(90deg, var(--color-border), var(--color-border) 2px, transparent 2px, transparent 40px)",
    borderBottom: "4px solid var(--color-border)",
  },
  "wall-dungeon": {
    background: "linear-gradient(180deg, #181c26 0%, #0d0f14 100%)",
    borderBottom: "4px double var(--color-dim)",
  },
  "wall-cyber": {
    background: "linear-gradient(180deg, #090b11 0%, #171026 100%)",
    borderBottom: "4px solid var(--color-status-waiting-external)",
  },
};

// Visual mapping for floors
const FLOOR_STYLES: Record<string, string> = {
  "floor-wood": "repeating-linear-gradient(90deg, #7c4a24, #7c4a24 15px, #653b1b 15px, #653b1b 30px)",
  "floor-carpet": "linear-gradient(180deg, #5c207a 0%, #3e1254 100%)",
  "floor-cyber": "repeating-linear-gradient(0deg, #10e0e0 0px, #10e0e0 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #10e0e0 0px, #10e0e0 1px, transparent 1px, transparent 20px)",
};

export function RoomDecoration() {
  const {
    characterSheet,
    purchasedDecorations,
    placedDecorations,
    purchaseDecoration,
    placeDecoration,
    moveDecoration,
  } = useTasks();

  const [activeTab, setActiveTab] = useState<"desk" | "chair" | "decor" | "wallpaper" | "floor">("desk");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ category: "desk" | "chair" | "decor" | "wallpaper" | "floor"; offsetX: number; offsetY: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const sheet = characterSheet;
  const currentCoins = sheet.totalCoins;

  // Helper to extract item ID from old (string) or new (object) format
  const getItemId = (item: any): string | null => {
    if (!item) return null;
    return typeof item === "string" ? item : item.id;
  };

  // Helper to extract position from item
  const getPosition = (item: any): { x: number; y: number } => {
    if (!item || typeof item === "string") return { x: 0, y: 0 };
    return { x: item.x || 0, y: item.y || 0 };
  };

  // Resolve placed items (with defaults if empty)
  const currentDesk = getItemId(placedDecorations.desk) || "desk-wood";
  const currentChair = getItemId(placedDecorations.chair) || "chair-stool";
  const currentDecor = getItemId(placedDecorations.decor) || "decor-none";
  const currentWall = getItemId(placedDecorations.wallpaper) || "wall-brick";
  const currentFloor = getItemId(placedDecorations.floor) || "floor-wood";

  const deskPos = getPosition(placedDecorations.desk);
  const chairPos = getPosition(placedDecorations.chair);
  const decorPos = getPosition(placedDecorations.decor);

  const deskObj = DECORATIONS_CATALOG.find((d) => d.id === currentDesk);
  const chairObj = DECORATIONS_CATALOG.find((d) => d.id === currentChair);
  const decorObj = DECORATIONS_CATALOG.find((d) => d.id === currentDecor);

  const filteredCatalog = DECORATIONS_CATALOG.filter((item) => item.category === activeTab);

  const handleBuy = async (item: DecorationItem) => {
    setBuyingId(item.id);
    try {
      await purchaseDecoration(item.id);
    } finally {
      setBuyingId(null);
    }
  };

  const handlePlace = async (item: DecorationItem) => {
    setPlacingId(item.id);
    try {
      // If the item is "decor-none" or similar, we might pass null to clear
      const isNone = item.id.endsWith("-none");
      await placeDecoration(activeTab, isNone ? null : item.id);
    } finally {
      setPlacingId(null);
    }
  };

  const getPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    if ("touches" in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, category: "desk" | "chair" | "decor" | "wallpaper" | "floor", currentX: number, currentY: number) => {
    const point = getPoint(e);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = point.x - rect.left;
    const offsetY = point.y - rect.top;
    setDragging({ category, offsetX, offsetY });
    setDragPos({ x: currentX, y: currentY });
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging || !dragPos) return;
    const point = getPoint(e);
    const roomRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((point.x - roomRect.left - dragging.offsetX) / roomRect.width) * 100));
    const yFromTop = ((point.y - roomRect.top - dragging.offsetY) / roomRect.height) * 100;
    const y = Math.max(0, Math.min(100, 100 - yFromTop));
    setDragPos({ x, y });
  };

  const handleDragEnd = async () => {
    if (!dragging || !dragPos) return;
    await moveDecoration(dragging.category, dragPos.x, dragPos.y);
    setDragging(null);
    setDragPos(null);
  };

  const wallStyle = WALLPAPER_STYLES[currentWall] || WALLPAPER_STYLES["wall-brick"];
  const floorBg = FLOOR_STYLES[currentFloor] || FLOOR_STYLES["floor-wood"];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 1. ROOM VIEWPORT */}
      <div
        className="relative overflow-hidden border-4 select-none"
        data-room-viewport
        onMouseMove={handleMouseMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleDragEnd}
        onTouchCancel={handleDragEnd}
        style={{
          height: "260px",
          borderColor: "var(--color-primary-gold)",
          boxShadow: "0 0 24px rgba(240,180,41,0.15), inset 0 0 20px rgba(0,0,0,0.8)",
          cursor: dragging ? "grabbing" : "default",
          touchAction: dragging ? "none" : undefined,
        }}
      >
        {/* Wall background */}
        <div 
          className="absolute inset-0 transition-all duration-300"
          style={{ 
            bottom: "30%", 
            background: wallStyle.background,
            borderBottom: wallStyle.borderBottom,
          }}
        />

        {/* Floor background */}
        <div 
          className="absolute inset-x-0 bottom-0 transition-all duration-300"
          style={{ 
            height: "30%", 
            background: floorBg,
            backgroundColor: currentFloor === "floor-cyber" ? "#0a0a0f" : "#4e2d19",
            opacity: currentFloor === "floor-cyber" ? 0.9 : 1,
          }}
        />

        {/* Room Title overlay */}
        <div className="absolute top-3 left-3 bg-deep border-2 border-border px-3 py-1 font-display text-[8px] uppercase tracking-wider text-muted-foreground">
          🏡 OFFICE OUTPOST (LV.{sheet.globalLevel})
        </div>

        {/* Character Avatar */}
        <div 
          className="absolute font-display flex flex-col items-center"
          style={{ 
            left: "25%", 
            bottom: "22%", 
            zIndex: 10,
            fontSize: "36px",
            animation: "pixelFloat 2.5s ease-in-out infinite"
          }}
        >
          <span>🧙</span>
          <div className="bg-deep border border-border px-1.5 py-0.5 mt-1 text-[7px] text-foreground tracking-widest uppercase">
            Aric
          </div>
        </div>

        {/* Placed Chair */}
        {chairObj && currentChair === chairObj.id && placedDecorations.chair && (
          <div
            className="absolute select-none cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => handleDragStart(e, "chair", chairPos.x, chairPos.y)}
            onTouchStart={(e) => handleDragStart(e, "chair", chairPos.x, chairPos.y)}
            style={{
              left: `${dragging?.category === "chair" && dragPos ? dragPos.x : chairPos.x}%`,
              bottom: `${dragging?.category === "chair" && dragPos ? dragPos.y : chairPos.y}%`,
              zIndex: 5,
              fontSize: "38px",
              touchAction: "none",
              transition: dragging?.category === "chair" ? "none" : "all 300ms",
            }}
            title={`${chairObj.name} (drag to move)`}
          >
            {chairObj.emoji}
          </div>
        )}

        {/* Placed Desk */}
        {deskObj && currentDesk === deskObj.id && placedDecorations.desk && (
          <div
            className="absolute select-none cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => handleDragStart(e, "desk", deskPos.x, deskPos.y)}
            onTouchStart={(e) => handleDragStart(e, "desk", deskPos.x, deskPos.y)}
            style={{
              left: `${dragging?.category === "desk" && dragPos ? dragPos.x : deskPos.x}%`,
              bottom: `${dragging?.category === "desk" && dragPos ? dragPos.y : deskPos.y}%`,
              zIndex: 8,
              fontSize: "44px",
              touchAction: "none",
              transition: dragging?.category === "desk" ? "none" : "all 300ms",
            }}
            title={`${deskObj.name} (drag to move)`}
          >
            {deskObj.emoji}
          </div>
        )}

        {/* Placed Decor */}
        {decorObj && decorObj.id !== "decor-none" && currentDecor === decorObj.id && placedDecorations.decor && (
          <div
            className="absolute select-none cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => handleDragStart(e, "decor", decorPos.x, decorPos.y)}
            onTouchStart={(e) => handleDragStart(e, "decor", decorPos.x, decorPos.y)}
            style={{
              left: `${dragging?.category === "decor" && dragPos ? dragPos.x : decorPos.x}%`,
              bottom: `${dragging?.category === "decor" && dragPos ? dragPos.y : decorPos.y}%`,
              zIndex: 6,
              fontSize: "34px",
              touchAction: "none",
              animation: decorObj.id === "decor-lava" ? "pixelPulse 2s ease-in-out infinite" : "none",
              transition: dragging?.category === "decor" ? "none" : "all 300ms",
            }}
            title={`${decorObj.name} (drag to move)`}
          >
            {decorObj.emoji}
          </div>
        )}
      </div>

      {/* 2. COINS OVERVIEW & CATEGORY TABS */}
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-display text-[9px] text-muted-foreground uppercase tracking-widest">▸ PURCHASE DECORATIONS</span>
          <div className="flex items-center gap-1 border border-border bg-card px-2.5 py-0.5 font-display text-[9px]" style={{ color: "var(--color-coin)" }}>
            🪙 {currentCoins} COINS
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:pb-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className="shrink-0 whitespace-nowrap px-3 py-1 font-display text-[8px] uppercase border transition-all"
              style={{
                backgroundColor: activeTab === cat.id ? "var(--color-primary-gold)" : "var(--color-bg-panel-alt)",
                color: activeTab === cat.id ? "var(--color-bg-deep)" : "var(--color-text-primary)",
                borderColor: activeTab === cat.id ? "var(--color-primary-gold)" : "var(--color-border)",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. CATALOG ITEMS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCatalog.map((item) => {
          const isFree = item.cost === 0;
          const isOwned = purchasedDecorations.includes(item.id) || isFree;
          
          // Determine if placed (must be both displayed AND in DB)
          let isPlaced = false;
          const isInDb = placedDecorations[activeTab] !== null && placedDecorations[activeTab] !== undefined;
          if (activeTab === "desk") isPlaced = isInDb && currentDesk === item.id;
          else if (activeTab === "chair") isPlaced = isInDb && currentChair === item.id;
          else if (activeTab === "decor") isPlaced = isInDb && currentDecor === item.id;
          else if (activeTab === "wallpaper") isPlaced = isInDb && currentWall === item.id;
          else if (activeTab === "floor") isPlaced = isInDb && currentFloor === item.id;

          const isAffordable = currentCoins >= item.cost;

          return (
            <div
              key={item.id}
              className="bg-card p-4 border-2 transition-all flex flex-col justify-between"
              style={{
                borderColor: isPlaced ? "var(--color-primary-gold)" : "var(--color-border)",
                opacity: !isOwned && !isAffordable ? 0.6 : 1,
              }}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{item.emoji}</span>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{item.name}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  {isPlaced && (
                    <span 
                      className="font-display text-[7px] bg-primary-gold text-deep px-1.5 py-0.5 tracking-wider"
                      style={{ backgroundColor: "var(--color-primary-gold)", color: "var(--color-bg-deep)" }}
                    >
                      PLACED
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 pt-2 border-t border-border/40">
                <div className="font-display text-[9px]" style={{ color: "var(--color-coin)" }}>
                  {isFree ? "FREE" : `🪙 ${item.cost}`}
                </div>

                {isOwned ? (
                  <button
                    disabled={isPlaced || placingId === item.id}
                    onClick={() => handlePlace(item)}
                    className="px-3 py-1 font-display text-[8px] uppercase border-2 text-foreground disabled:opacity-50 transition-all flex items-center justify-center gap-1 active:translate-y-0.5"
                    style={{
                      borderColor: isPlaced ? "var(--color-dim)" : "var(--color-primary-gold)",
                      backgroundColor: "transparent",
                    }}
                  >
                    {placingId === item.id ? "PLACING..." : isPlaced ? "IN USE" : "PLACE"}
                  </button>
                ) : (
                  <button
                    disabled={!isAffordable || buyingId === item.id}
                    onClick={() => handleBuy(item)}
                    className="px-3 py-1 font-display text-[8px] uppercase border-2 text-deep disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-1 active:translate-y-0.5"
                    style={{
                      backgroundColor: "var(--color-primary-gold)",
                      borderColor: "var(--color-primary-gold)",
                    }}
                  >
                    {buyingId === item.id ? "BUYING..." : "BUY"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating animation keyframes styles */}
      <style jsx global>{`
        @keyframes pixelFloat {
          0% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
