import type { Knex } from "knex";

// Web login sessions — completely separate from climbing "sessions".
//
// Lifecycle:
//   1. Google callback succeeds → row created with oauth_account_id set,
//      user_id null if this is a new user who hasn't picked a handle yet.
//   2. User completes onboarding (picks handle) → user_id is filled in.
//   3. Cookie value is session_token; verify by looking up this table.
//   4. Logout or expiry → row deleted.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("auth_sessions", (t) => {
    t.uuid("id").primary().defaultTo(knex.fn.uuid());

    // Stored in an HttpOnly cookie on the client
    t.text("session_token").notNullable().unique();

    // The Google account that authenticated this session
    t.uuid("oauth_account_id")
      .notNullable()
      .references("id")
      .inTable("oauth_accounts")
      .onDelete("CASCADE");

    // Null until onboarding is complete (handle chosen)
    t.text("user_id")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    t.timestamp("expires_at").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("auth_sessions");
}
