import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("boards", (t) => {
    t.text("id").primary(); // stable slug, e.g. 'kilter-original'
    t.text("name").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // Initial boards — new boards can be added via the admin flow described separately.
  await knex("boards").insert([
    { id: "kilter-original",  name: "Kilter Board (Original)" },
    { id: "moonboard-2016",   name: "Moonboard 2016" },
    { id: "tension-board-1",  name: "Tension Board 1 (TB1)" },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("boards");
}
