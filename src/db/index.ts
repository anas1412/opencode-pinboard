import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import * as schema from "./schema";

const DB_PATH =
  process.env.OPENTACK_DB_PATH ||
  `${process.env.HOME}/.opentack/db.sqlite`;

// Ensure parent directory exists
const dir = DB_PATH.substring(0, DB_PATH.lastIndexOf("/"));
mkdirSync(dir, { recursive: true });

const sqlite = new Database(DB_PATH, { create: true });
sqlite.exec("PRAGMA journal_mode=WAL;");
sqlite.exec("PRAGMA foreign_keys=ON;");

export const db = drizzle(sqlite, { schema });

export { schema };
