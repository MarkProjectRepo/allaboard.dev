import knex from "knex";
import type { Knex } from "knex";

// Prevent connection pool exhaustion during Next.js dev hot-reloads.
const globalForKnex = global as unknown as { knex?: Knex };

function createDb(): Knex {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL;

  return knex({
    client: "pg",
    connection: connectionString
      ? {
          connectionString,
          ssl: { rejectUnauthorized: false },
        }
      : {
          host: "localhost",
          port: 5432,
          user: process.env.PGUSER ?? process.env.USER,
          database: "allaboard",
        },
  });
}

const db = globalForKnex.knex ?? createDb();
if (process.env.NODE_ENV !== "production") globalForKnex.knex = db;

export default db;
