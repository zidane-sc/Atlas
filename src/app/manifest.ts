import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atlas - Your Second Brain",
    short_name: "Atlas",
    description: "Gamified personal task manager with retro pixel-RPG aesthetics",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0f14",
    theme_color: "#0d0f14",
    orientation: "portrait",
    categories: ["productivity", "games"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
