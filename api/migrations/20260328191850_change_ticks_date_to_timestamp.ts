import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE ticks ALTER COLUMN date TYPE timestamp USING date::timestamp`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE ticks ALTER COLUMN date TYPE date USING date::date`);
}

