import type { Knex } from "knex";

// Links a Google OAuth identity to a users row.
// user_id is nullable: it is null between Google callback and handle selection
// (the onboarding step). Once the user picks a handle, user_id is set and
// the users row is created.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("oauth_accounts", (t) => {
    t.uuid("id").primary().defaultTo(knex.fn.uuid());

    // OAuth provider — only 'google' for now
    t.text("provider").notNullable().defaultTo("google");

    // Google's stable user identifier (the "sub" claim in the ID token)
    t.text("provider_user_id").notNullable();

    // Email address as reported by Google
    t.text("email").notNullable();

    // Linked allaboard user — null until onboarding is complete
    t.text("user_id")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");

    // OAuth tokens (store securely / encrypt at rest in production)
    t.text("access_token").nullable();
    t.text("refresh_token").nullable();
    t.timestamp("token_expires_at").nullable();

    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.unique(["provider", "provider_user_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("oauth_accounts");
}
