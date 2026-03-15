import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

let _pool: Pool | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

/** Returns the shared Drizzle instance. Lazy-initialised on first call. */
export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) {
    return _db;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to connect to the database");
  }
  _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _db = drizzle(_pool, { schema });
  return _db;
}
