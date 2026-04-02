import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table("users", (t) => {
    // gen_random_uuid() fills existing rows automatically — no separate backfill needed.
    t.uuid("api_token")
      .notNullable()
      .defaultTo(knex.raw("gen_random_uuid()"))
      .unique();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table("users", (t) => {
    t.dropColumn("api_token");
  });
}
