export interface DecorationItem {
  id: string;
  name: string;
  category: "desk" | "chair" | "decor" | "wallpaper" | "floor";
  cost: number;
  description: string;
  emoji: string;
}

export const DECORATIONS_CATALOG: DecorationItem[] = [
  // Desk setups
  { id: "desk-wood", name: "Wooden Desk", category: "desk", cost: 0, description: "Simple sturdy wood desk", emoji: "🪵" },
  { id: "desk-crt", name: "CRT Setup", category: "desk", cost: 10, description: "Classic retro terminal screen", emoji: "📺" },
  { id: "desk-rgb", name: "RGB Gaming Desk", category: "desk", cost: 35, description: "Pulsing neon and speed", emoji: "⌨️" },
  
  // Chairs
  { id: "chair-stool", name: "Wooden Stool", category: "chair", cost: 0, description: "Creaky but reliable stool", emoji: "🪑" },
  { id: "chair-ergo", name: "Ergonomic Chair", category: "chair", cost: 15, description: "Saves your lumbar", emoji: "🛋️" },
  { id: "chair-throne", name: "Gaming Throne", category: "chair", cost: 40, description: "Max comfort for code gods", emoji: "👑" },

  // Decors
  { id: "decor-none", name: "None", category: "decor", cost: 0, description: "Empty slot", emoji: "❌" },
  { id: "decor-fern", name: "Potted Fern", category: "decor", cost: 5, description: "Breathes fresh oxygen", emoji: "🌿" },
  { id: "decor-bonsai", name: "Bonsai Tree", category: "decor", cost: 12, description: "Teaches patience and focus", emoji: "🪴" },
  { id: "decor-lava", name: "Lava Lamp", category: "decor", cost: 18, description: "Mesmerizing floating gloobs", emoji: "🔮" },
  { id: "decor-neon-cat", name: "Neon Cat Sign", category: "decor", cost: 25, description: "Glows with purr-pose", emoji: "🐱" },
  { id: "decor-trophy", name: "Golden Trophy", category: "decor", cost: 30, description: "Proof of ultimate victory", emoji: "🏆" },

  // Wallpapers
  { id: "wall-brick", name: "Brick Wall", category: "wallpaper", cost: 0, description: "Solid brick masonry", emoji: "🧱" },
  { id: "wall-dungeon", name: "Dungeon Stone", category: "wallpaper", cost: 15, description: "Classic dark dungeon mood", emoji: "🪨" },
  { id: "wall-cyber", name: "Cyber Neon", category: "wallpaper", cost: 25, description: "Glows in the dark", emoji: "🌌" },

  // Floors
  { id: "floor-wood", name: "Oak Planks", category: "floor", cost: 0, description: "Classic oak flooring", emoji: "🪵" },
  { id: "floor-carpet", name: "Royal Purple Carpet", category: "floor", cost: 10, description: "Soft under your feet", emoji: "🟥" },
  { id: "floor-cyber", name: "Cyber Grid", category: "floor", cost: 22, description: "Step into the matrix", emoji: "📐" },
];
