import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("oauth_accounts", (t) => {
    // Google profile picture URL — stored here so it's available before
    // a users row exists (i.e. during the onboarding / handle-selection step).
    t.text("profile_picture_url").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("oauth_accounts", (t) => {
    t.dropColumn("profile_picture_url");
  });
}
