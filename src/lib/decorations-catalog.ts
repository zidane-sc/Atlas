export interface DecorationItem {
  id: string;
  name: string;
  category: "desk" | "chair" | "decor" | "wallpaper" | "floor";
  cost: number;
  description: string;
  emoji: string;
}

export const DEFAULT_DECORATION_POSITIONS: Record<string, { x: number; y: number }> = {
  desk: { x: 55, y: 12 },
  chair: { x: 40, y: 12 },
  decor: { x: 75, y: 14 },
};

export const DECORATIONS_CATALOG: DecorationItem[] = [
  // Desks
  { id: "desk-wood", name: "Wooden Desk", category: "desk", cost: 0, description: "Simple sturdy wood desk", emoji: "🪵" },
  { id: "desk-crt", name: "CRT Setup", category: "desk", cost: 10, description: "Classic retro terminal screen", emoji: "📺" },
  { id: "desk-rgb", name: "RGB Gaming Desk", category: "desk", cost: 35, description: "Pulsing neon and speed", emoji: "⌨️" },
  { id: "desk-standing", name: "Standing Hacker Desk", category: "desk", cost: 45, description: "Dual monitors for maximum velocity", emoji: "🖥️" },
  { id: "desk-alchemist", name: "Alchemist Workbench", category: "desk", cost: 60, description: "Bubbling potions and ancient scrolls", emoji: "⚗️" },

  // Chairs
  { id: "chair-stool", name: "Wooden Stool", category: "chair", cost: 0, description: "Creaky but reliable stool", emoji: "🪑" },
  { id: "chair-beanbag", name: "Retro Beanbag", category: "chair", cost: 8, description: "Sink in and think deep thoughts", emoji: "🛋️" },
  { id: "chair-ergo", name: "Ergonomic Chair", category: "chair", cost: 15, description: "Saves your lumbar", emoji: "💺" },
  { id: "chair-throne", name: "Gaming Throne", category: "chair", cost: 40, description: "Max comfort for code gods", emoji: "👑" },
  { id: "chair-hover", name: "Antigravity Pod", category: "chair", cost: 55, description: "Zero friction, floating magnetic seat", emoji: "🛸" },

  // Decors
  { id: "decor-none", name: "None", category: "decor", cost: 0, description: "Empty slot", emoji: "❌" },
  { id: "decor-coffee", name: "Endless Coffee", category: "decor", cost: 5, description: "Hot brew that never runs dry", emoji: "☕" },
  { id: "decor-fern", name: "Potted Fern", category: "decor", cost: 5, description: "Breathes fresh oxygen into the lab", emoji: "🌿" },
  { id: "decor-bonsai", name: "Bonsai Tree", category: "decor", cost: 12, description: "Teaches patience and deep focus", emoji: "🪴" },
  { id: "decor-lava", name: "Lava Lamp", category: "decor", cost: 18, description: "Mesmerizing floating glow", emoji: "🔮" },
  { id: "decor-radio", name: "Lo-Fi Boombox", category: "decor", cost: 22, description: "Chill beats to study & code to", emoji: "📻" },
  { id: "decor-neon-cat", name: "Neon Cat Sign", category: "decor", cost: 25, description: "Glows with purr-pose in the dark", emoji: "🐱" },
  { id: "decor-crystal", name: "Mana Crystal", category: "decor", cost: 28, description: "Emits a calming arcane resonance", emoji: "💎" },
  { id: "decor-trophy", name: "Golden Trophy", category: "decor", cost: 30, description: "Proof of ultimate victory", emoji: "🏆" },
  { id: "decor-arcade", name: "Mini Arcade Cabinet", category: "decor", cost: 38, description: "Loaded with retro pixel classics", emoji: "🕹️" },
  { id: "decor-sword", name: "Pixel Master Sword", category: "decor", cost: 50, description: "Forged in legendary 8-bit steel", emoji: "🗡️" },

  // Wallpapers
  { id: "wall-brick", name: "Brick Wall", category: "wallpaper", cost: 0, description: "Solid brick masonry", emoji: "🧱" },
  { id: "wall-cabin", name: "Pine Cabin", category: "wallpaper", cost: 10, description: "Cozy warm timber log walls", emoji: "🌲" },
  { id: "wall-dungeon", name: "Dungeon Stone", category: "wallpaper", cost: 15, description: "Classic dark dungeon fortress mood", emoji: "🪨" },
  { id: "wall-arcade", name: "Neon Arcade", category: "wallpaper", cost: 20, description: "Retro synthwave 80s aesthetic", emoji: "👾" },
  { id: "wall-cyber", name: "Cyber Neon", category: "wallpaper", cost: 25, description: "High-tech matrix grid glowing dark", emoji: "🌌" },
  { id: "wall-space", name: "Deep Space", category: "wallpaper", cost: 30, description: "Starlit cosmic observatory window", emoji: "🌠" },

  // Floors
  { id: "floor-wood", name: "Oak Planks", category: "floor", cost: 0, description: "Classic polished oak flooring", emoji: "🪵" },
  { id: "floor-carpet", name: "Royal Purple Carpet", category: "floor", cost: 10, description: "Soft luxury under your boots", emoji: "🟥" },
  { id: "floor-tatami", name: "Tatami Mats", category: "floor", cost: 15, description: "Traditional woven rush grass mats", emoji: "🌾" },
  { id: "floor-checkered", name: "Retro Checkered", category: "floor", cost: 18, description: "Classic monochrome diner tiles", emoji: "🏁" },
  { id: "floor-cyber", name: "Cyber Grid", category: "floor", cost: 22, description: "Step into glowing cyan coordinates", emoji: "📐" },
  { id: "floor-stone", name: "Castle Flagstone", category: "floor", cost: 25, description: "Ancient fortified grey slabs", emoji: "🏰" },
];
