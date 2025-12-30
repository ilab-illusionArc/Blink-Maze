import { getDb } from "../utils/db";

export default defineEventHandler((event) => {
  const q = getQuery(event);

  const mode = (q.mode === "random" ? "random" : "daily") as "daily" | "random";
  const seed = typeof q.seed === "string" ? q.seed : "";
  const limit = Math.min(50, Math.max(1, Number(q.limit ?? 20)));

  if (!seed) return { ok: false, error: "seed_required" };

  const db = getDb();
  const stmt = db.prepare(`
    SELECT name, score, time_ms, blinks, moves, invalid_moves, created_at
    FROM scores
    WHERE mode = ? AND seed = ?
    ORDER BY score DESC, time_ms ASC
    LIMIT ?
  `);

  const rows = stmt.all(mode, seed, limit);
  return { ok: true, mode, seed, rows };
});
