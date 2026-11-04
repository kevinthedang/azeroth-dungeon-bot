import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { Collection } from 'discord.js'
import { cleanup, loadCore } from './helpers.js'

const core = await loadCore()

afterAll(cleanup)

test('exposes the sprite catalog', () => {
    assert.deepEqual(core.spriteKeys(), ['female_tauren'])
    assert.equal(core.isSpriteKey('female_tauren'), true)
    assert.equal(core.isSpriteKey('male_orc'), false)
    assert.equal(core.spriteLabel('female_tauren'), 'Female Tauren')
    assert.equal(core.spriteEmojiName('female_tauren'), 'sp_female_tauren')
})

test('resolveSpriteEmoji falls back to Unicode before registration', () => {
    assert.equal(core.resolveSpriteEmoji('female_tauren'), '🐮')
    assert.equal(core.resolveSpriteEmoji('male_orc'), '')
    assert.equal(core.resolveSpriteEmoji(null), '')
    assert.equal(core.resolveSpriteEmoji(undefined), '')
})

test('getSpriteUrl is undefined until the emoji is registered', () => {
    assert.equal(core.getSpriteUrl('female_tauren'), undefined)
})

test('setPlayerSprite stores, replaces, and isolates sprites per guild', () => {
    core.setPlayerSprite('guild-a', 'user-1', 'female_tauren')
    assert.equal(core.getPlayerSprite('guild-a', 'user-1'), 'female_tauren')

    assert.equal(core.getPlayerSprite('guild-b', 'user-1'), null)
    assert.equal(core.getPlayerSprite('guild-a', 'user-2'), null)
})

test('getPlayerSprite ignores rows holding an unknown sprite key', () => {
    core.db
        .prepare(`
            INSERT INTO player_sprites (guild_id, user_id, sprite, updated_at)
            VALUES (?, ?, ?, ?)
        `)
        .run('guild-bad', 'user-bad', 'male_orc', Date.now())

    assert.equal(core.getPlayerSprite('guild-bad', 'user-bad'), null)
})

test('clearPlayerSprite reports whether a sprite was removed', () => {
    core.setPlayerSprite('guild-clear', 'user-1', 'female_tauren')

    assert.equal(core.clearPlayerSprite('guild-clear', 'user-1'), true)
    assert.equal(core.getPlayerSprite('guild-clear', 'user-1'), null)
    assert.equal(core.clearPlayerSprite('guild-clear', 'user-1'), false)
})

test('registerSpriteEmojis picks up matching application emojis', async () => {
    const emojis = new Collection<string, { id: string; name: string }>()
    emojis.set('emoji-1', { id: '123456789', name: 'sp_female_tauren' })
    emojis.set('emoji-2', { id: '999', name: 'something_else' })

    const client = {
        application: {
            emojis: {
                fetch: async () => emojis,
            },
        },
    }

    await core.registerSpriteEmojis(client as never)

    assert.equal(
        core.getSpriteUrl('female_tauren'),
        'https://cdn.discordapp.com/emojis/123456789.png',
    )
    assert.equal(core.resolveSpriteEmoji('female_tauren'), '<:sp_female_tauren:123456789>')
})

test('registerSpriteEmojis clears state when the application is unavailable', async () => {
    await core.registerSpriteEmojis({ application: null } as never)

    assert.equal(core.getSpriteUrl('female_tauren'), undefined)
    assert.equal(core.resolveSpriteEmoji('female_tauren'), '🐮')
})
