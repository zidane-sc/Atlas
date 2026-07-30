import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js convention keeps local secrets in `.env.local`, not `.env` — match it here.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI (migrate, studio, db pull) uses the direct connection — bypasses Neon's pooler.
    url: env("DIRECT_URL"),
  },
});
