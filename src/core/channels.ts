import { db } from './db.js'

export function setCommandChannel(guildId: string, channelId: string): void {
    db.prepare(`
        INSERT INTO guild_command_channels (guild_id, channel_id)
        VALUES (?, ?)
        ON CONFLICT (guild_id) DO UPDATE SET channel_id = excluded.channel_id
    `).run(guildId, channelId)
}

export function getCommandChannel(guildId: string): string | null {
    const row = db.prepare(`
        SELECT channel_id FROM guild_command_channels WHERE guild_id = ?
    `).get(guildId)

    return row ? String(row.channel_id) : null
}

export function clearCommandChannel(guildId: string): boolean {
    const result = db.prepare(`
        DELETE FROM guild_command_channels WHERE guild_id = ?
    `).run(guildId)

    return result.changes > 0
}

export function isCommandChannelAllowed(
    guildId: string,
    channelId: string,
    parentId?: string | null,
): boolean {
    const allowedChannelId = getCommandChannel(guildId)
    if (!allowedChannelId) return true

    return channelId === allowedChannelId || parentId === allowedChannelId
}
