import Database from "better-sqlite3";

let db: Database.Database | null = null;

function tryAddColumn(database: Database.Database, table: string, columnSql: string) {
  try {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${columnSql};`);
  } catch {
    // already exists
  }
}

export function getDb() {
  if (db) return db;

  db = new Database("blinkmaze.sqlite");

  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL,
      seed TEXT NOT NULL,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      time_ms INTEGER NOT NULL,
      blinks INTEGER NOT NULL,
      moves INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scores_mode_seed ON scores(mode, seed);
    CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score);
  `);

  // migration
  tryAddColumn(db, "scores", "invalid_moves INTEGER NOT NULL DEFAULT 0");

  return db;
}
