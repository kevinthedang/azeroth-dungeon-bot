import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// store the database next to the project, regardless of how the bot is launched
const databasePath = resolve(process.cwd(), 'data', 'azeroth.db')
mkdirSync(dirname(databasePath), { recursive: true })

/**
 * Shared SQLite connection. `node:sqlite` is built into Node >= 22.5,
 * so no native dependency is required.
 */
export const db = new DatabaseSync(databasePath)

// WAL keeps writes durable without blocking reads; the partial unique index
// guarantees at most one live (running or paused) dungeon per channel. Foreign
// keys let run members disappear automatically when their run is cleared.
db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS runs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT    NOT NULL,
        channel_id   TEXT    NOT NULL,
        dungeon      TEXT    NOT NULL,
        started_at   INTEGER NOT NULL,
        ended_at     INTEGER,
        paused_total INTEGER NOT NULL DEFAULT 0,
        paused_at    INTEGER,
        status       TEXT    NOT NULL DEFAULT 'running',
        message_id   TEXT
    );

    CREATE TABLE IF NOT EXISTS run_members (
        run_id   INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        user_id  TEXT    NOT NULL,
        username TEXT    NOT NULL,
        PRIMARY KEY (run_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS player_roles (
        guild_id   TEXT    NOT NULL,
        user_id    TEXT    NOT NULL,
        role       TEXT    NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
    );

    DROP INDEX IF EXISTS one_active_run;

    CREATE UNIQUE INDEX IF NOT EXISTS one_active_run
        ON runs (channel_id) WHERE status IN ('running', 'paused');

    CREATE INDEX IF NOT EXISTS runs_by_dungeon
        ON runs (guild_id, dungeon COLLATE NOCASE);
`)

/** Add a column to an existing database created before it existed. */
function ensureColumn(table: string, column: string, definition: string): void {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all()
    if (!columns.some(existing => String(existing.name) === column))
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
}

ensureColumn('runs', 'paused_total', 'paused_total INTEGER NOT NULL DEFAULT 0')
ensureColumn('runs', 'paused_at', 'paused_at INTEGER')
