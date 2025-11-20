import dotenv from "dotenv";
import path from "path";
import { defineConfig, env } from "prisma/config";

// Load ENV before configuration is evaluated
dotenv.config({
  path: path.resolve(__dirname, "../", ".env")
});

export default defineConfig(({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  }
}));
