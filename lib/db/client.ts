import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

if (!process.env.SUPABASE_DB_URL) {
  throw new Error("SUPABASE_DB_URL is not set. Add it to your environment variables.");
}

const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });

export const db = drizzle(pool);
