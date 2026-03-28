import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("ticks", (t) => {
    t.dropUnique(["climb_id", "user_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("ticks", (t) => {
    t.unique(["climb_id", "user_id"]);
  });
}

