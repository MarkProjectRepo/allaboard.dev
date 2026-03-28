import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (t) => {
    // Populated from Google identity on first login
    t.text("email").nullable();
    t.text("profile_picture_url").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("email");
    t.dropColumn("profile_picture_url");
  });
}
