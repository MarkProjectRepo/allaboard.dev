import type { Knex } from "knex";

// Neon (production) provides two connection strings via the Vercel integration:
//   DATABASE_URL          — pooled (PgBouncer). Good for serverless; NOT safe for migrations
//                           because PgBouncer transaction mode breaks Knex's advisory locks.
//   DATABASE_URL_UNPOOLED — direct connection. Required for migrations; also preferred for
//                           a long-running Express server that manages its own pool via Knex.
//
// Local development: neither variable is set → falls back to local Postgres (no SSL).
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

const config: Knex.Config = {
  client: "pg",
  connection: connectionString
    ? {
        connectionString,
        // Neon requires SSL. Node's pg driver doesn't always honour sslmode= in
        // the URL when going through Knex, so we set it explicitly here.
        // rejectUnauthorized: false keeps the connection encrypted while avoiding
        // certificate-chain issues that vary by Node/platform version.
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: "localhost",
        port: 5432,
        user: process.env.PGUSER ?? process.env.USER,
        database: "allaboard",
      },
  migrations: {
    directory: "./migrations",
    extension: "ts",
    loadExtensions: [".ts"],
  },
  seeds: {
    directory: "./seeds",
    extension: "ts",
    loadExtensions: [".ts"],
  },
};

// CLI helper — run via `tsx knexfile.ts migrate|rollback|seed|migrate:make <name>`
const [, , command, ...args] = process.argv;
if (command) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const knex = require("knex")(config);
  (async () => {
    try {
      if (command === "migrate") {
        const [batch, applied] = await knex.migrate.latest();
        console.log(`Batch ${batch} — ran ${applied.length} migration(s):`, applied);
      } else if (command === "rollback") {
        const [batch, reverted] = await knex.migrate.rollback();
        console.log(`Rolled back batch ${batch}:`, reverted);
      } else if (command === "seed") {
        await knex.seed.run();
        console.log("Seeds ran successfully.");
      } else if (command === "migrate:make" && args[0]) {
        const file = await knex.migrate.make(args[0]);
        console.log("Created migration:", file);
      } else {
        console.error("Unknown command:", command);
        process.exit(1);
      }
    } catch (err) {
      console.error(err);
      process.exit(1);
    } finally {
      await knex.destroy();
    }
  })();
}

export default config;
