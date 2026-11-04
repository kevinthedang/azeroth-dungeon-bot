import type { Client } from 'discord.js'
import { db } from './db.js'

/**
 * Every character sprite the bot can show. Keys follow `{gender}_{race}` so the
 * catalog can grow to every playable race without renaming anything.
 */
const SPRITES = {
    female_tauren: { label: 'Female Tauren', fallback: '🐮' },
} as const

export type SpriteKey = keyof typeof SPRITES

const EMOJI_PREFIX = 'sp_'

const emojiIds = new Map<SpriteKey, string>()

const upsertSpriteStmt = db.prepare(`
    INSERT INTO player_sprites (guild_id, user_id, sprite, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET sprite = excluded.sprite, updated_at = excluded.updated_at
`)

const selectSpriteStmt = db.prepare(`
    SELECT sprite FROM player_sprites
    WHERE guild_id = ? AND user_id = ?
`)

const deleteSpriteStmt = db.prepare(`
    DELETE FROM player_sprites WHERE guild_id = ? AND user_id = ?
`)

export function isSpriteKey(value: string): value is SpriteKey {
    return Object.hasOwn(SPRITES, value)
}

export function spriteKeys(): SpriteKey[] {
    return Object.keys(SPRITES) as SpriteKey[]
}

export function spriteLabel(key: SpriteKey): string {
    return SPRITES[key].label
}

export function spriteEmojiName(key: SpriteKey): string {
    return `${EMOJI_PREFIX}${key}`
}

export async function registerSpriteEmojis(client: Client): Promise<void> {
    emojiIds.clear()

    const application = client.application
    if (!application) return

    const emojis = await application.emojis.fetch()
    const byName = new Map<string, string>()

    for (const emoji of emojis.values()) {
        if (emoji.name) byName.set(emoji.name, emoji.id)
    }

    for (const key of spriteKeys()) {
        const id = byName.get(spriteEmojiName(key))
        if (id) emojiIds.set(key, id)
    }
}

/** Inline emoji markup for a sprite, or its Unicode fallback. */
export function resolveSpriteEmoji(key: string | null | undefined): string {
    if (!key || !isSpriteKey(key)) return ''

    const id = emojiIds.get(key)
    return id ? `<:${spriteEmojiName(key)}:${id}>` : SPRITES[key].fallback
}

/** CDN image URL for a sprite's emoji, or `undefined` when not uploaded. */
export function getSpriteUrl(key: SpriteKey): string | undefined {
    const id = emojiIds.get(key)
    return id ? `https://cdn.discordapp.com/emojis/${id}.png` : undefined
}

/** Set (or replace) the sprite shown next to a member's name. */
export function setPlayerSprite(guildId: string, userId: string, sprite: SpriteKey): void {
    upsertSpriteStmt.run(guildId, userId, sprite, Date.now())
}

/** The member's chosen sprite, or `null` when they have not picked one. */
export function getPlayerSprite(guildId: string, userId: string): SpriteKey | null {
    const row = selectSpriteStmt.get(guildId, userId)
    const sprite = row?.sprite

    if (sprite === null || sprite === undefined) return null

    const value = String(sprite)
    return isSpriteKey(value) ? value : null
}

/** Remove a member's sprite. Returns `false` when they had none. */
export function clearPlayerSprite(guildId: string, userId: string): boolean {
    const { changes } = deleteSpriteStmt.run(guildId, userId)
    return Number(changes) > 0
}
