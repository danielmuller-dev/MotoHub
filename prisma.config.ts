import "dotenv/config";
import { defineConfig } from "prisma/config";

const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error("Configure DATABASE_URL ou DIRECT_URL antes de executar comandos do Prisma.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  engine: "classic",
  datasource: {
    url: datasourceUrl
  }
});
