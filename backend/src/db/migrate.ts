import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pool } from "./index";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function run() {
  const client = await pool.connect();
  try {
    // GitHub Actions and Railway pre-deploy may start for the same commit. A
    // session-scoped advisory lock makes exactly one runner the migration owner.
    await client.query("SELECT pg_advisory_lock(hashtext('lashlyai-schema-migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const applied = new Set(
      (await client.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename),
    );
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip (already applied): ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('lashlyai-schema-migrations'))").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
