import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("ticks", (t) => {
    t.integer("attempts").nullable(); // null = "a bunch"
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("ticks", (t) => {
    t.dropColumn("attempts");
  });
}
