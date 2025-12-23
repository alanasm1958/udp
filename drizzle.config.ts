import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is missing. Put it in .env or .env.local");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
});
