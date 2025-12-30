import { getDb } from "../utils/db";

function clampName(raw: unknown) {
  const s = String(raw ?? "").trim();
  const clean = s.replace(/[^\p{L}\p{N}_ .-]/gu, "").slice(0, 18);
  return clean || "Guest";
}

/**
 * IMPORTANT: keep these constants in sync with the client component.
 * This version penalizes blinks more strongly.
 */
const SCORE_BASE = 6000;
const TIME_PENALTY_PER_SEC = 10;   // slower drain
const MOVE_PENALTY = 4;
const INVALID_PENALTY = 14;
const BLINK_PENALTY = 160;         // ✅ stronger blink penalty

function computeScore(timeMs: number, blinks: number, moves: number, invalidMoves: number) {
  const seconds = Math.floor(Math.max(0, timeMs) / 1000);
  const timePenalty = seconds * TIME_PENALTY_PER_SEC;
  const blinkPenalty = blinks * BLINK_PENALTY;
  const movePenalty = moves * MOVE_PENALTY;
  const invalidPenalty = invalidMoves * INVALID_PENALTY;
  return Math.max(0, Math.floor(SCORE_BASE - timePenalty - blinkPenalty - movePenalty - invalidPenalty));
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const mode = body?.mode === "random" ? "random" : "daily";
  const seed = typeof body?.seed === "string" ? body.seed : "";
  const name = clampName(body?.name);

  const timeMs = Number(body?.timeMs ?? 0) | 0;
  const blinks = Number(body?.blinks ?? 0) | 0;
  const moves = Number(body?.moves ?? 0) | 0;
  const invalidMoves = Number(body?.invalidMoves ?? 0) | 0;

  if (!seed) return { ok: false, error: "seed_required" };
  if (timeMs <= 0) return { ok: false, error: "invalid_time" };

  if (timeMs < 400 || timeMs > 30 * 60 * 1000) return { ok: false, error: "time_out_of_range" };
  if (blinks < 0 || blinks > 9999) return { ok: false, error: "invalid_blinks" };
  if (moves < 0 || moves > 999999) return { ok: false, error: "invalid_moves" };
  if (invalidMoves < 0 || invalidMoves > 999999) return { ok: false, error: "invalid_invalidMoves" };

  const score = computeScore(timeMs, blinks, moves, invalidMoves);

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO scores (mode, seed, name, score, time_ms, blinks, moves, invalid_moves, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = insert.run(mode, seed, name, score, timeMs, blinks, moves, invalidMoves, Date.now());
  const insertedId = Number(info.lastInsertRowid);

  const rankStmt = db.prepare(`
    SELECT COUNT(*) as better
    FROM scores
    WHERE mode = ? AND seed = ?
      AND (
        score > ?
        OR (score = ? AND time_ms < ?)
      )
  `);

  const better = (rankStmt.get(mode, seed, score, score, timeMs) as any)?.better ?? 0;
  const rank = Number(better) + 1;

  return { ok: true, score, rank, id: insertedId };
});
