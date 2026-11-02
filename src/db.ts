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
// guarantees at most one running dungeon per channel.
db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS runs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT    NOT NULL,
        channel_id TEXT    NOT NULL,
        dungeon    TEXT    NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at   INTEGER,
        status     TEXT    NOT NULL DEFAULT 'running',
        message_id TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS one_active_run
        ON runs (channel_id) WHERE status = 'running';

    CREATE INDEX IF NOT EXISTS runs_by_dungeon
        ON runs (guild_id, dungeon COLLATE NOCASE);
`)
