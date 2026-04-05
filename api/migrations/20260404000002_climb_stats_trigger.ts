import type { Knex } from "knex";

/**
 * Adds a trigger that keeps climbs.sends and climbs.star_rating in sync with
 * the ticks table automatically.
 *
 * Previously the application code recomputed these values after every
 * INSERT, UPDATE, or DELETE on ticks, which left them vulnerable to drift
 * if any tick row was modified outside the normal API path.
 *
 * After this migration the application code no longer needs to touch these
 * columns — the trigger handles it for every mutation on ticks.
 *
 * The migration also resyncs the current values from the actual ticks rows
 * so the starting state is clean.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Create the trigger function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION sync_climb_stats()
    RETURNS TRIGGER AS $$
    DECLARE
      target_climb_id UUID;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        target_climb_id := OLD.climb_id;
      ELSE
        target_climb_id := NEW.climb_id;
      END IF;

      UPDATE climbs SET
        star_rating = (
          SELECT ROUND(AVG(rating)::numeric, 2)
          FROM ticks
          WHERE climb_id = target_climb_id
        ),
        sends = (
          SELECT COUNT(*)
          FROM ticks
          WHERE climb_id = target_climb_id AND sent = true
        )
      WHERE id = target_climb_id;

      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 2. Attach the trigger to the ticks table
  await knex.raw(`
    CREATE TRIGGER ticks_climb_stats_sync
    AFTER INSERT OR UPDATE OR DELETE ON ticks
    FOR EACH ROW EXECUTE FUNCTION sync_climb_stats();
  `);

  // 3. Resync all climb stats from the actual ticks rows
  await knex.raw(`
    UPDATE climbs SET
      star_rating = (
        SELECT ROUND(AVG(t.rating)::numeric, 2)
        FROM ticks t
        WHERE t.climb_id = climbs.id
      ),
      sends = (
        SELECT COUNT(*)
        FROM ticks t
        WHERE t.climb_id = climbs.id AND t.sent = true
      );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TRIGGER IF EXISTS ticks_climb_stats_sync ON ticks;`);
  await knex.raw(`DROP FUNCTION IF EXISTS sync_climb_stats;`);
}
