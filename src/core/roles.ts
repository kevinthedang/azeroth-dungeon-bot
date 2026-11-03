import { db } from './db.js'

/** The four roles used by WoW Forever dungeon groups. */
export const WOW_ROLES = ['Tank', 'Melee', 'Ranged', 'Healer'] as const
export type WowRole = (typeof WOW_ROLES)[number]

const upsertRoleStmt = db.prepare(`
    INSERT INTO player_roles (guild_id, user_id, role, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at
`)

const selectRoleStmt = db.prepare(`
    SELECT role FROM player_roles
    WHERE guild_id = ? AND user_id = ?
`)

export function isWowRole(value: string): value is WowRole {
    return (WOW_ROLES as readonly string[]).includes(value)
}

/** Set (or replace) a member's WoW role for the guild. */
export function setPlayerRole(guildId: string, userId: string, role: WowRole): void {
    upsertRoleStmt.run(guildId, userId, role, Date.now())
}

export function getPlayerRole(guildId: string, userId: string): WowRole | null {
    const row = selectRoleStmt.get(guildId, userId)
    const role = row?.role

    if (role === null || role === undefined) return null

    const value = String(role)
    return isWowRole(value) ? value : null
}
