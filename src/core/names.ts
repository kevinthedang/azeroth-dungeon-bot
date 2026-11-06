import { db } from './db.js'

/** WoW character names are short; keep the card readable too. */
export const WOW_NAME_MIN_LENGTH = 2
export const WOW_NAME_MAX_LENGTH = 24

/** Letters, spaces, plus apostrophes and hyphens some realms allow. */
const WOW_NAME_PATTERN = /^[\p{L}][\p{L}'-]*(?: [\p{L}][\p{L}'-]*)*$/u

const upsertNameStmt = db.prepare(`
    INSERT INTO player_names (guild_id, user_id, name, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at
`)

const selectNameStmt = db.prepare(`
    SELECT name FROM player_names
    WHERE guild_id = ? AND user_id = ?
`)

const deleteNameStmt = db.prepare(`
    DELETE FROM player_names WHERE guild_id = ? AND user_id = ?
`)

/**
 * Clean up a name entered by a member. Returns `null` when it is not a valid
 * character name, so callers can show the rules.
 */
export function normalizeWowName(value: string): string | null {
    const name = value.trim()

    if (name.length < WOW_NAME_MIN_LENGTH || name.length > WOW_NAME_MAX_LENGTH) return null
    if (!WOW_NAME_PATTERN.test(name)) return null

    return name
}

/** Set the WoW name shown next to a member's sprite on the run card. */
export function setPlayerName(guildId: string, userId: string, name: string): void {
    upsertNameStmt.run(guildId, userId, name, Date.now())
}

/** The member's WoW name, or `null` when they have not set one. */
export function getPlayerName(guildId: string, userId: string): string | null {
    const row = selectNameStmt.get(guildId, userId)
    if (row?.name === null || row?.name === undefined) return null

    return String(row.name)
}

/** Remove a member's WoW name. Returns `false` when they had none. */
export function clearPlayerName(guildId: string, userId: string): boolean {
    const { changes } = deleteNameStmt.run(guildId, userId)
    return Number(changes) > 0
}
