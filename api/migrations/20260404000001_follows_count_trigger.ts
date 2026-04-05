import type { Knex } from "knex";

/**
 * Adds a trigger that keeps users.followers_count and users.following_count
 * in sync with the follows table automatically.
 *
 * Previously the application code manually incremented / decremented these
 * counters on every follow/unfollow, which left them vulnerable to drift if
 * any row was inserted or deleted outside the normal API path.
 *
 * After this migration the application code no longer needs to touch the
 * counters — the trigger handles it for every INSERT and DELETE on follows.
 *
 * The migration also resyncs the current counts from the actual follows rows
 * so the starting state is clean.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Create the trigger function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION sync_follow_counts()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
        UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
      ELSIF TG_OP = 'DELETE' THEN
        UPDATE users
          SET followers_count = GREATEST(followers_count - 1, 0)
          WHERE id = OLD.following_id;
        UPDATE users
          SET following_count = GREATEST(following_count - 1, 0)
          WHERE id = OLD.follower_id;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 2. Attach the trigger to the follows table
  await knex.raw(`
    CREATE TRIGGER follows_count_sync
    AFTER INSERT OR DELETE ON follows
    FOR EACH ROW EXECUTE FUNCTION sync_follow_counts();
  `);

  // 3. Resync all counters from the actual follows rows
  await knex.raw(`
    UPDATE users SET
      followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = users.id),
      following_count = (SELECT COUNT(*) FROM follows WHERE follower_id  = users.id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TRIGGER IF EXISTS follows_count_sync ON follows;`);
  await knex.raw(`DROP FUNCTION IF EXISTS sync_follow_counts;`);
}
