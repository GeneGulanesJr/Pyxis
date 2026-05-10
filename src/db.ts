/**
 * PiStats SQLite persistence via sql.js (WASM-based, no native compilation).
 * Stores session metadata and per-turn token attribution.
 */

import initSqlJs, { type Database } from "sql.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AttributionResult } from "./attributor.js";

const DB_PATH = join(homedir(), ".pi", "agent", "pistats.db");

let db: Database | null = null;
let dbReady = false;

async function getDb(): Promise<Database> {
  if (db && dbReady) return db;

  const SQL = await initSqlJs();
  const dbDir = join(homedir(), ".pi", "agent");

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      model TEXT NOT NULL,
      context_window INTEGER NOT NULL,
      cwd TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      turn_index INTEGER NOT NULL,
      entry_id TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read INTEGER NOT NULL DEFAULT 0,
      cache_write INTEGER NOT NULL DEFAULT 0,
      cost_total REAL NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL,
      user_content TEXT,
      assistant_content TEXT,
      UNIQUE(session_id, turn_index)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS segment_breakdown (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turn_id INTEGER NOT NULL REFERENCES turns(id),
      segment TEXT NOT NULL,
      tokens INTEGER NOT NULL DEFAULT 0,
      percentage REAL NOT NULL DEFAULT 0,
      UNIQUE(turn_id, segment)
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_segments_turn ON segment_breakdown(turn_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_time ON sessions(started_at)`);

  // Migrate: add content columns if they don't exist (existing DBs)
  try {
    const cols = db.exec("PRAGMA table_info(turns)");
    const colNames = cols[0]?.values?.map((r: any) => r[1]) || [];
    if (!colNames.includes('user_content')) {
      db.run('ALTER TABLE turns ADD COLUMN user_content TEXT');
    }
    if (!colNames.includes('assistant_content')) {
      db.run('ALTER TABLE turns ADD COLUMN assistant_content TEXT');
    }
  } catch {
    // Table doesn't exist yet — CREATE TABLE handles it
  }

  saveDb();
  dbReady = true;
  return db;
}

function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dir = join(homedir(), ".pi", "agent");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(DB_PATH, buffer);
  } catch {
    // Fail silently — in-memory tracking still works
  }
}

/** Get the database file path */
export function getDbPath(): string {
  return DB_PATH;
}

/** Flush the database to disk */
export function flushDb(): void {
  saveDb();
}

/** Close the database and save */
export async function closeDb(): Promise<void> {
  if (db) {
    saveDb();
    db.close();
    db = null;
    dbReady = false;
  }
}

/** Insert a new session record */
export async function insertSession(sessionId: string, model: string, contextWindow: number, cwd: string): Promise<void> {
  try {
    const database = await getDb();
    database.run(
      `INSERT OR REPLACE INTO sessions (id, model, context_window, cwd, started_at) VALUES (?, ?, ?, ?, ?)`,
      [sessionId, model, contextWindow, cwd, new Date().toISOString()]
    );
    saveDb();
  } catch (e) {
    console.error("[PiStats] Failed to insert session:", e);
  }
}

/** Update session end time */
export async function updateSessionEnd(sessionId: string): Promise<void> {
  try {
    const database = await getDb();
    database.run(
      `UPDATE sessions SET ended_at = ? WHERE id = ?`,
      [new Date().toISOString(), sessionId]
    );
    saveDb();
  } catch (e) {
    console.error("[PiStats] Failed to update session end:", e);
  }
}

/** Insert a turn with its segment breakdown */
export async function insertTurn(
  sessionId: string,
  turnIndex: number,
  entryId: string | null,
  attribution: AttributionResult,
): Promise<void> {
  try {
    const database = await getDb();
    const timestamp = new Date().toISOString();
    // cacheReadPct is already relative to totalInput (which includes cacheRead),
    // so this recovers the raw cacheRead token count accurately.
    const cacheRead = attribution.cacheReadPct > 0
      ? Math.round(attribution.totalInput * attribution.cacheReadPct / 100)
      : 0;

    database.run(
      `INSERT OR REPLACE INTO turns (session_id, turn_index, entry_id, input_tokens, output_tokens, cache_read, cache_write, cost_total, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, turnIndex, entryId, attribution.totalInput, attribution.totalOutput,
       cacheRead, 0, attribution.totalCost, timestamp]
    );

    // Get the turn ID
    const result = database.exec(`SELECT id FROM turns WHERE session_id = ? AND turn_index = ?`, [sessionId, turnIndex]);
    const turnId = result[0]?.values[0]?.[0];

    if (turnId !== undefined && turnId !== null) {
      for (const segment of attribution.segments) {
        database.run(
          `INSERT OR REPLACE INTO segment_breakdown (turn_id, segment, tokens, percentage) VALUES (?, ?, ?, ?)`,
          [turnId, segment.segmentId, segment.tokens, segment.percentage]
        );
      }
    }

    saveDb();
  } catch (e) {
    console.error("[PiStats] Failed to insert turn:", e);
  }
}

/** Query last N sessions with aggregate stats */
export async function getRecentSessions(limit: number = 10): Promise<any[]> {
  try {
    const database = await getDb();
    const result = database.exec(
      `SELECT s.id, s.model, s.context_window, s.cwd, s.started_at, s.ended_at,
              SUM(t.input_tokens) as total_input, SUM(t.output_tokens) as total_output, SUM(t.cost_total) as total_cost
       FROM sessions s LEFT JOIN turns t ON s.id = t.session_id
       GROUP BY s.id ORDER BY s.started_at DESC LIMIT ?`, [limit]);
    return result[0]?.values?.map(row => ({
      id: row[0], model: row[1], contextWindow: row[2], cwd: row[3],
      startedAt: row[4], endedAt: row[5],
      totalInput: row[6], totalOutput: row[7], totalCost: row[8],
    })) || [];
  } catch {
    return [];
  }
}

/** Query turns for a specific session */
export async function getSessionTurns(sessionId: string): Promise<any[]> {
  try {
    const database = await getDb();
    const result = database.exec(
      `SELECT t.turn_index, t.input_tokens, t.output_tokens, t.cache_read, t.cost_total, t.timestamp
       FROM turns t WHERE t.session_id = ? ORDER BY t.turn_index ASC`, [sessionId]);
    return result[0]?.values?.map(row => ({
      turnIndex: row[0], inputTokens: row[1], outputTokens: row[2],
      cacheRead: row[3], costTotal: row[4], timestamp: row[5],
    })) || [];
  } catch {
    return [];
  }
}

/** Query top N segment bloaters across all sessions */
export async function getTopSegments(limit: number = 5): Promise<any[]> {
  try {
    const database = await getDb();
    const result = database.exec(
      `SELECT sb.segment, SUM(sb.tokens) as total_tokens, AVG(sb.percentage) as avg_pct
       FROM segment_breakdown sb JOIN turns t ON sb.turn_id = t.id
       GROUP BY sb.segment ORDER BY total_tokens DESC LIMIT ?`, [limit]);
    return result[0]?.values?.map(row => ({
      segment: row[0], totalTokens: row[1], avgPct: row[2],
    })) || [];
  } catch {
    return [];
  }
}