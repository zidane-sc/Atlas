"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTasks } from "@/components/providers/TasksProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import {
  DECORATIONS_CATALOG,
  DEFAULT_DECORATION_POSITIONS,
  type DecorationItem,
} from "@/lib/decorations-catalog";
import { playRetroCoin, playRetroEquip, playRetroBlip, playRetroSparkle } from "@/lib/audio";
import { Sparkles, Eye, RotateCcw, Volume2, VolumeX } from "lucide-react";

const CATEGORIES = [
  { id: "desk", label: "Desks", icon: "🪵" },
  { id: "chair", label: "Chairs", icon: "🪑" },
  { id: "decor", label: "Decors", icon: "🔮" },
  { id: "wallpaper", label: "Wallpaper", icon: "🧱" },
  { id: "floor", label: "Flooring", icon: "📐" },
] as const;

// Visual mapping for wallpapers
const WALLPAPER_STYLES: Record<string, { background: string; borderBottom: string }> = {
  "wall-brick": {
    background:
      "linear-gradient(rgba(19, 22, 29, 0.88), rgba(19, 22, 29, 0.88)), repeating-linear-gradient(0deg, var(--color-border), var(--color-border) 2px, transparent 2px, transparent 20px), repeating-linear-gradient(90deg, var(--color-border), var(--color-border) 2px, transparent 2px, transparent 40px)",
    borderBottom: "4px solid var(--color-border)",
  },
  "wall-cabin": {
    background:
      "repeating-linear-gradient(0deg, #3d2311 0px, #3d2311 26px, #2a1609 26px, #2a1609 30px)",
    borderBottom: "4px solid #5a381e",
  },
  "wall-dungeon": {
    background:
      "linear-gradient(180deg, #181c26 0%, #0d0f14 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 48px)",
    borderBottom: "4px double var(--color-dim)",
  },
  "wall-arcade": {
    background:
      "radial-gradient(ellipse at bottom, #2d0e52 0%, #0d0722 100%), repeating-linear-gradient(0deg, rgba(255,0,128,0.08) 0px, rgba(255,0,128,0.08) 1px, transparent 1px, transparent 4px)",
    borderBottom: "4px solid #ff007f",
  },
  "wall-cyber": {
    background:
      "linear-gradient(180deg, #090b11 0%, #171026 100%), repeating-linear-gradient(90deg, rgba(16,224,224,0.06) 0px, rgba(16,224,224,0.06) 1px, transparent 1px, transparent 32px)",
    borderBottom: "4px solid var(--color-status-waiting-external)",
  },
  "wall-space": {
    background:
      "radial-gradient(circle at 75% 25%, #252e55 0%, #080a14 75%), radial-gradient(circle at 20% 80%, #301b4d 0%, transparent 40%)",
    borderBottom: "4px solid #4a5d99",
  },
};

// Visual mapping for floors
const FLOOR_STYLES: Record<string, { background: string; bgColor: string; opacity?: number }> = {
  "floor-wood": {
    background: "repeating-linear-gradient(90deg, #7c4a24, #7c4a24 15px, #653b1b 15px, #653b1b 30px)",
    bgColor: "#4e2d19",
  },
  "floor-carpet": {
    background: "linear-gradient(180deg, #5c207a 0%, #3e1254 100%)",
    bgColor: "#3e1254",
  },
  "floor-tatami": {
    background:
      "repeating-linear-gradient(0deg, #829161 0px, #829161 12px, #6b774f 12px, #6b774f 14px), repeating-linear-gradient(90deg, transparent 0px, transparent 70px, #36472d 70px, #36472d 74px)",
    bgColor: "#758354",
  },
  "floor-checkered": {
    background:
      "repeating-conic-gradient(#1a1d26 0% 25%, #303746 0% 50%) 50% / 32px 32px",
    bgColor: "#1a1d26",
  },
  "floor-cyber": {
    background:
      "repeating-linear-gradient(0deg, #10e0e0 0px, #10e0e0 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #10e0e0 0px, #10e0e0 1px, transparent 1px, transparent 20px)",
    bgColor: "#0a0a0f",
    opacity: 0.9,
  },
  "floor-stone": {
    background:
      "repeating-linear-gradient(0deg, #373b44 0px, #373b44 20px, #23272f 20px, #23272f 22px), repeating-linear-gradient(90deg, transparent 0px, transparent 40px, #23272f 40px, #23272f 42px)",
    bgColor: "#2e323b",
  },
};

export function RoomDecoration() {
  const { data: session } = useSession();
  const {
    characterSheet,
    purchasedDecorations,
    placedDecorations,
    purchaseDecoration,
    placeDecoration,
    moveDecoration,
    resetDecorationPositions,
  } = useTasks();
  const { soundEnabled } = useSettings();

  const [activeTab, setActiveTab] = useState<"desk" | "chair" | "decor" | "wallpaper" | "floor">("desk");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DecorationItem | null>(null);

  // Drag state
  const [dragging, setDragging] = useState<{
    category: "desk" | "chair" | "decor";
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // Interactive speech bubble
  const [bubble, setBubble] = useState<{ text: string; x: number; y: number } | null>(null);
  const bubbleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Particle coin burst animation
  const [coinChange, setCoinChange] = useState<number | null>(null);

  const sheet = characterSheet;
  const currentCoins = sheet.totalCoins;
  const userName = session?.user?.name || "Zidane";

  const triggerBubble = (text: string, x: number, y: number) => {
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setBubble({ text, x, y });
    bubbleTimerRef.current = setTimeout(() => setBubble(null), 2800);
  };

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  // Helper to extract item ID from old (string) or new (object) format
  const getItemId = (item: any): string | null => {
    if (!item) return null;
    return typeof item === "string" ? item : item.id;
  };

  // Helper to extract position with fallback to defaults
  const getPosition = (
    item: any,
    category: "desk" | "chair" | "decor"
  ): { x: number; y: number } => {
    const def = DEFAULT_DECORATION_POSITIONS[category] || { x: 50, y: 12 };
    if (!item) return def;
    if (typeof item === "string") return def;
    return {
      x: item.x !== undefined ? item.x : def.x,
      y: item.y !== undefined ? item.y : def.y,
    };
  };

  // Resolve placed items (with preview override if active)
  const realDesk = getItemId(placedDecorations.desk) || "desk-wood";
  const realChair = getItemId(placedDecorations.chair) || "chair-stool";
  const realDecor = getItemId(placedDecorations.decor) || "decor-none";
  const realWall = getItemId(placedDecorations.wallpaper) || "wall-brick";
  const realFloor = getItemId(placedDecorations.floor) || "floor-wood";

  const currentDesk = previewItem?.category === "desk" ? previewItem.id : realDesk;
  const currentChair = previewItem?.category === "chair" ? previewItem.id : realChair;
  const currentDecor = previewItem?.category === "decor" ? previewItem.id : realDecor;
  const currentWall = previewItem?.category === "wallpaper" ? previewItem.id : realWall;
  const currentFloor = previewItem?.category === "floor" ? previewItem.id : realFloor;

  const deskPos = getPosition(placedDecorations.desk, "desk");
  const chairPos = getPosition(placedDecorations.chair, "chair");
  const decorPos = getPosition(placedDecorations.decor, "decor");

  const deskObj = DECORATIONS_CATALOG.find((d) => d.id === currentDesk);
  const chairObj = DECORATIONS_CATALOG.find((d) => d.id === currentChair);
  const decorObj = DECORATIONS_CATALOG.find((d) => d.id === currentDecor);

  const filteredCatalog = DECORATIONS_CATALOG.filter((item) => item.category === activeTab);

  const handleBuy = async (item: DecorationItem) => {
    setBuyingId(item.id);
    try {
      const ok = await purchaseDecoration(item.id);
      if (ok) {
        if (soundEnabled) playRetroCoin();
        setCoinChange(item.cost);
        setTimeout(() => setCoinChange(null), 1500);
      }
    } finally {
      setBuyingId(null);
    }
  };

  const handlePlace = async (item: DecorationItem) => {
    setPlacingId(item.id);
    try {
      const isNone = item.id.endsWith("-none");
      const ok = await placeDecoration(activeTab, isNone ? null : item.id);
      if (ok) {
        if (soundEnabled) playRetroEquip();
        if (previewItem?.id === item.id) setPreviewItem(null);
      }
    } finally {
      setPlacingId(null);
    }
  };

  const handleResetPositions = async () => {
    if (soundEnabled) playRetroEquip();
    await resetDecorationPositions();
  };

  const getPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    if ("touches" in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const snap = (val: number): number => Math.round(val / 2) * 2;

  const handleDragStart = (
    e: React.MouseEvent | React.TouchEvent,
    category: "desk" | "chair" | "decor",
    currentX: number,
    currentY: number
  ) => {
    const point = getPoint(e);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = point.x - rect.left;
    const offsetY = point.y - rect.top;
    setDragging({ category, offsetX, offsetY });
    setDragPos({ x: currentX, y: currentY });
    if (soundEnabled) playRetroBlip();
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging || !dragPos) return;
    const point = getPoint(e);
    const roomRect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    const rawX = ((point.x - roomRect.left - dragging.offsetX) / roomRect.width) * 100;
    const rawYFromTop = ((point.y - roomRect.top - dragging.offsetY) / roomRect.height) * 100;
    const rawY = 100 - rawYFromTop;

    // Constrain within floor zone: X: 4% - 88%, Y: 6% - 26%
    const x = Math.max(4, Math.min(88, snap(rawX)));
    const y = Math.max(6, Math.min(26, snap(rawY)));
    setDragPos({ x, y });
  };

  const handleDragEnd = async () => {
    if (!dragging || !dragPos) return;
    if (soundEnabled) playRetroEquip();
    await moveDecoration(dragging.category, dragPos.x, dragPos.y);
    setDragging(null);
    setDragPos(null);
  };

  const wallStyle = WALLPAPER_STYLES[currentWall] || WALLPAPER_STYLES["wall-brick"];
  const floorConfig = FLOOR_STYLES[currentFloor] || FLOOR_STYLES["floor-wood"];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 1. ROOM VIEWPORT */}
      <div
        className="relative overflow-hidden border-4 select-none rounded-none"
        data-room-viewport
        onMouseMove={handleMouseMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleDragEnd}
        onTouchCancel={handleDragEnd}
        style={{
          height: "320px",
          borderColor: "var(--color-primary-gold)",
          boxShadow: "0 0 32px rgba(240,180,41,0.2), inset 0 0 24px rgba(0,0,0,0.85)",
          cursor: dragging ? "grabbing" : "default",
          touchAction: dragging ? "none" : undefined,
        }}
      >
        {/* Wall background */}
        <div
          className="absolute inset-0 transition-all duration-300"
          style={{
            bottom: "32%",
            background: wallStyle.background,
            borderBottom: wallStyle.borderBottom,
          }}
        />

        {/* Ambient Window with Pixel Day/Night Horizon */}
        <div
          className="absolute top-4 right-8 z-10 hidden sm:flex flex-col border-2 overflow-hidden"
          style={{
            width: "56px",
            height: "64px",
            borderColor: "var(--color-border)",
            backgroundColor: "#05070e",
            boxShadow: "0 0 12px rgba(240,180,41,0.15)",
          }}
        >
          <div
            className="flex-1 w-full"
            style={{
              background:
                "linear-gradient(180deg, #0b1536 0%, #1c2e63 60%, #462c4d 100%)",
            }}
          >
            <div className="relative w-full h-full">
              <span className="absolute top-1 right-2 text-[10px]">✨</span>
              <span className="absolute top-4 left-2 text-[8px]">⭐</span>
              <div
                className="absolute bottom-2 right-3 w-3 h-3 rounded-full bg-yellow-200"
                style={{ boxShadow: "0 0 8px rgba(255,255,180,0.8)" }}
              />
            </div>
          </div>
          <div className="h-1 bg-border w-full" />
        </div>

        {/* Floor background */}
        <div
          className="absolute inset-x-0 bottom-0 transition-all duration-300"
          style={{
            height: "32%",
            background: floorConfig.background,
            backgroundColor: floorConfig.bgColor,
            opacity: floorConfig.opacity ?? 1,
          }}
        />

        {/* Dragging Grid Overlay */}
        {dragging && (
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none z-10"
            style={{
              height: "32%",
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(240,180,41,0.15) 0px, rgba(240,180,41,0.15) 1px, transparent 1px, transparent 16px), repeating-linear-gradient(90deg, rgba(240,180,41,0.15) 0px, rgba(240,180,41,0.15) 1px, transparent 1px, transparent 16px)",
            }}
          />
        )}

        {/* Header HUD Overlays */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <div
            className="border-2 px-3 py-1 font-display text-[9px] uppercase tracking-wider"
            style={{
              backgroundColor: "var(--color-bg-deep)",
              borderColor: "var(--color-border)",
              color: "var(--color-primary-gold)",
            }}
          >
            🏡 {userName}&apos;s OUTPOST (LV.{sheet.globalLevel})
          </div>
          <button
            type="button"
            onClick={handleResetPositions}
            title="Reset furniture positions to default"
            className="border-2 p-1 text-muted-foreground hover:text-foreground hover:border-primary-gold transition-colors"
            style={{
              backgroundColor: "var(--color-bg-deep)",
              borderColor: "var(--color-border)",
            }}
          >
            <RotateCcw size={12} />
          </button>
        </div>

        {/* Preview Banner */}
        {previewItem && (
          <div
            className="absolute top-3 right-3 z-30 flex items-center gap-2 border-2 px-3 py-1 animate-pulse"
            style={{
              backgroundColor: "var(--color-bg-deep)",
              borderColor: "var(--color-primary-gold)",
            }}
          >
            <span className="font-display text-[8px]" style={{ color: "var(--color-primary-gold)" }}>
              PREVIEW: {previewItem.name}
            </span>
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              className="text-[9px] font-bold text-muted-foreground hover:text-foreground ml-1"
            >
              ✕ EXIT
            </button>
          </div>
        )}

        {/* Interactive Speech/Thought Bubble */}
        {bubble && (
          <div
            className="absolute z-40 pointer-events-none px-2.5 py-1 text-xs font-mono font-bold border-2 animate-in fade-in zoom-in-95 duration-150"
            style={{
              left: `${bubble.x}%`,
              bottom: `${bubble.y + 12}%`,
              transform: "translateX(-50%)",
              backgroundColor: "var(--color-bg-deep)",
              borderColor: "var(--color-primary-gold)",
              color: "var(--color-text-primary)",
              boxShadow: "2px 2px 0px rgba(0,0,0,0.8)",
            }}
          >
            {bubble.text}
            <div
              className="absolute left-1/2 -bottom-1 w-2 h-2 -translate-x-1/2 rotate-45 border-r-2 border-b-2"
              style={{
                backgroundColor: "var(--color-bg-deep)",
                borderColor: "var(--color-primary-gold)",
              }}
            />
          </div>
        )}

        {/* Character Avatar */}
        <div
          className="absolute font-display flex flex-col items-center cursor-pointer select-none group"
          onClick={() => {
            if (soundEnabled) playRetroSparkle();
            triggerBubble(`*${sheet.classTitle} ${userName} ready for quests!*`, 24, 22);
          }}
          style={{
            left: "24%",
            bottom: "16%",
            zIndex: 15,
            fontSize: "40px",
            animation: "pixelFloat 2.5s ease-in-out infinite",
          }}
          title="Click to interact"
        >
          <span className="filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.7)] group-hover:scale-110 transition-transform">
            🧙‍♂️
          </span>
          <div
            className="border px-1.5 py-0.5 mt-0.5 text-[8px] font-mono font-bold tracking-widest uppercase truncate max-w-[80px]"
            style={{
              backgroundColor: "var(--color-bg-deep)",
              borderColor: "var(--color-border)",
              color: "var(--color-primary-gold)",
            }}
          >
            {userName}
          </div>
        </div>

        {/* Companion Pip Pet in Room */}
        <div
          className="absolute cursor-pointer select-none flex flex-col items-center z-20 group"
          onClick={() => {
            if (soundEnabled) playRetroSparkle();
            triggerBubble("*Pip: Let's slay more quests today!* ⚡", 14, 11);
          }}
          style={{
            left: "14%",
            bottom: "11%",
            animation: "cmpBounce 1.2s ease-in-out infinite",
          }}
          title="Pip (Companion Lv. 3) - Click me!"
        >
          <span className="text-2xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] group-hover:scale-125 transition-transform">
            🐥
          </span>
          <span
            className="text-[7px] font-mono font-bold px-1 py-0 border opacity-80"
            style={{
              backgroundColor: "var(--color-bg-deep)",
              borderColor: "var(--color-border)",
              color: "var(--color-streak-flame)",
            }}
          >
            PIP
          </span>
        </div>

        {/* Placed Chair */}
        {chairObj && currentChair === chairObj.id && (
          <div
            className="absolute select-none cursor-grab active:cursor-grabbing group"
            onMouseDown={(e) => handleDragStart(e, "chair", chairPos.x, chairPos.y)}
            onTouchStart={(e) => handleDragStart(e, "chair", chairPos.x, chairPos.y)}
            onClick={() => {
              if (soundEnabled) playRetroBlip();
              triggerBubble(`*Relaxing on ${chairObj.name}*`, chairPos.x, chairPos.y);
            }}
            style={{
              left: `${dragging?.category === "chair" && dragPos ? dragPos.x : chairPos.x}%`,
              bottom: `${dragging?.category === "chair" && dragPos ? dragPos.y : chairPos.y}%`,
              zIndex: 8,
              fontSize: "38px",
              touchAction: "none",
              transition: dragging?.category === "chair" ? "none" : "all 200ms",
              filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.65))",
            }}
            title={`${chairObj.name} (drag to move)`}
          >
            {chairObj.emoji}
            {dragging?.category === "chair" && dragPos && (
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-deep border border-primary-gold px-1 py-0 text-[7px] font-mono text-primary-gold font-bold">
                {dragPos.x}%, {dragPos.y}%
              </span>
            )}
          </div>
        )}

        {/* Placed Desk */}
        {deskObj && currentDesk === deskObj.id && (
          <div
            className="absolute select-none cursor-grab active:cursor-grabbing group"
            onMouseDown={(e) => handleDragStart(e, "desk", deskPos.x, deskPos.y)}
            onTouchStart={(e) => handleDragStart(e, "desk", deskPos.x, deskPos.y)}
            onClick={() => {
              if (soundEnabled) playRetroBlip();
              triggerBubble(`*${deskObj.name} online: READY. >_*`, deskPos.x, deskPos.y);
            }}
            style={{
              left: `${dragging?.category === "desk" && dragPos ? dragPos.x : deskPos.x}%`,
              bottom: `${dragging?.category === "desk" && dragPos ? dragPos.y : deskPos.y}%`,
              zIndex: 10,
              fontSize: "44px",
              touchAction: "none",
              transition: dragging?.category === "desk" ? "none" : "all 200ms",
              filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.7))",
            }}
            title={`${deskObj.name} (drag to move)`}
          >
            {deskObj.emoji}
            {dragging?.category === "desk" && dragPos && (
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-deep border border-primary-gold px-1 py-0 text-[7px] font-mono text-primary-gold font-bold">
                {dragPos.x}%, {dragPos.y}%
              </span>
            )}
          </div>
        )}

        {/* Placed Decor */}
        {decorObj && decorObj.id !== "decor-none" && currentDecor === decorObj.id && (
          <div
            className="absolute select-none cursor-grab active:cursor-grabbing group"
            onMouseDown={(e) => handleDragStart(e, "decor", decorPos.x, decorPos.y)}
            onTouchStart={(e) => handleDragStart(e, "decor", decorPos.x, decorPos.y)}
            onClick={() => {
              if (soundEnabled) playRetroSparkle();
              triggerBubble(`*${decorObj.name} gives Focus Aura!* ✨`, decorPos.x, decorPos.y);
            }}
            style={{
              left: `${dragging?.category === "decor" && dragPos ? dragPos.x : decorPos.x}%`,
              bottom: `${dragging?.category === "decor" && dragPos ? dragPos.y : decorPos.y}%`,
              zIndex: 9,
              fontSize: "36px",
              touchAction: "none",
              animation: decorObj.id === "decor-lava" ? "pixelPulse 2s ease-in-out infinite" : "none",
              transition: dragging?.category === "decor" ? "none" : "all 200ms",
              filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.6))",
            }}
            title={`${decorObj.name} (drag to move)`}
          >
            {decorObj.emoji}
            {dragging?.category === "decor" && dragPos && (
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-deep border border-primary-gold px-1 py-0 text-[7px] font-mono text-primary-gold font-bold">
                {dragPos.x}%, {dragPos.y}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. COINS OVERVIEW & CATEGORY TABS */}
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-display text-[9px] text-muted-foreground uppercase tracking-widest">
            ▸ RETRO FURNITURE SHOP
          </span>
          <div
            className="relative flex items-center gap-1.5 border border-border bg-card px-3 py-1 font-display text-[9px]"
            style={{ color: "var(--color-coin)" }}
          >
            🪙 {currentCoins} COINS
            {coinChange !== null && (
              <span className="absolute -top-3 right-0 text-red-400 font-mono text-xs font-bold animate-out fade-out slide-out-to-top duration-1000">
                -{coinChange} 🪙
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:pb-0">
          {CATEGORIES.map((cat) => {
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  if (soundEnabled) playRetroBlip();
                  setActiveTab(cat.id);
                }}
                className="shrink-0 whitespace-nowrap px-3 py-1 font-display text-[8px] uppercase border transition-all flex items-center gap-1.5"
                style={{
                  backgroundColor: isActive ? "var(--color-primary-gold)" : "var(--color-bg-panel-alt)",
                  color: isActive ? "var(--color-bg-deep)" : "var(--color-text-primary)",
                  borderColor: isActive ? "var(--color-primary-gold)" : "var(--color-border)",
                  boxShadow: isActive ? "2px 2px 0px rgba(0,0,0,0.5)" : "none",
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. CATALOG ITEMS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCatalog.map((item) => {
          const isFree = item.cost === 0;
          const isOwned = purchasedDecorations.includes(item.id) || isFree;

          let isPlaced = false;
          const isInDb = placedDecorations[activeTab] !== null && placedDecorations[activeTab] !== undefined;
          if (activeTab === "desk") isPlaced = isInDb && realDesk === item.id;
          else if (activeTab === "chair") isPlaced = isInDb && realChair === item.id;
          else if (activeTab === "decor") isPlaced = isInDb && realDecor === item.id;
          else if (activeTab === "wallpaper") isPlaced = isInDb && realWall === item.id;
          else if (activeTab === "floor") isPlaced = isInDb && realFloor === item.id;

          const isPreviewing = previewItem?.id === item.id;
          const isAffordable = currentCoins >= item.cost;

          return (
            <div
              key={item.id}
              className="bg-card p-4 border-2 transition-all flex flex-col justify-between relative group"
              style={{
                borderColor: isPlaced
                  ? "var(--color-primary-gold)"
                  : isPreviewing
                  ? "var(--color-status-ready)"
                  : "var(--color-border)",
                opacity: !isOwned && !isAffordable ? 0.6 : 1,
                boxShadow: isPlaced ? "0 0 12px rgba(240,180,41,0.15)" : "none",
              }}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform">
                      {item.emoji}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        {item.name}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  {isPlaced && (
                    <span
                      className="font-display text-[7px] px-1.5 py-0.5 tracking-wider shrink-0"
                      style={{
                        backgroundColor: "var(--color-primary-gold)",
                        color: "var(--color-bg-deep)",
                      }}
                    >
                      PLACED
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                <div className="font-display text-[9px]" style={{ color: "var(--color-coin)" }}>
                  {isFree ? "FREE" : `🪙 ${item.cost}`}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Preview Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      if (soundEnabled) playRetroBlip();
                      setPreviewItem(isPreviewing ? null : item);
                    }}
                    title={isPreviewing ? "Exit preview" : "Preview in room"}
                    className="p-1 border text-xs text-muted-foreground hover:text-foreground transition-colors"
                    style={{
                      borderColor: isPreviewing ? "var(--color-status-ready)" : "var(--color-border)",
                      color: isPreviewing ? "var(--color-status-ready)" : undefined,
                    }}
                  >
                    <Eye size={12} />
                  </button>

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
                      {placingId === item.id ? "PLACING..." : isPlaced ? "EQUIPPED" : "EQUIP"}
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
            </div>
          );
        })}
      </div>

      {/* Floating animation keyframes styles */}
      <style jsx global>{`
        @keyframes pixelFloat {
          0% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
