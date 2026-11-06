import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { cleanup, loadCore, loadCommand } from './helpers.js'

const core = await loadCore()
const { SetChannel } = await loadCommand('setChannel')

afterAll(cleanup)

function makeInteraction(
    guildId: string | null,
    channelId = 'channel-1',
    manageGuild = true,
    isThread = false,
    parentId: string | null = null,
) {
    const replies: any[] = []
    const interaction = {
        guildId,
        channelId,
        channel: {
            isThread: () => isThread,
            parentId,
        },
        memberPermissions: {
            has: () => manageGuild,
        },
        user: { id: 'admin', tag: 'admin' },
        deferReply: async () => undefined,
        editReply: async (payload: any) => {
            replies.push(payload)
            return { id: 'reply' }
        },
    }

    return { interaction, replies }
}

function embedJson(reply: any) {
    return reply?.embeds?.[0]?.toJSON()
}

test('set-channel stores the current channel for the guild', async () => {
    const { interaction, replies } = makeInteraction('guild-channel')

    await SetChannel.run({} as never, interaction as never)

    assert.equal(core.getCommandChannel('guild-channel'), 'channel-1')
    assert.match(embedJson(replies[0]).description, /<#channel-1> and its threads/)
})

test('command restriction allows configured channel threads', () => {
    core.setCommandChannel('guild-thread-test', 'channel-parent')

    assert.equal(core.isCommandChannelAllowed('guild-thread-test', 'thread-1', 'channel-parent'), true)
    assert.equal(core.isCommandChannelAllowed('guild-thread-test', 'channel-other', null), false)
})

test('set-channel ignores category parentId for a normal text channel', async () => {
    const { interaction } = makeInteraction(
        'guild-categorized-channel',
        '1568088123039027220',
        true,
        false,
        'category-id',
    )

    await SetChannel.run({} as never, interaction as never)

    assert.equal(core.getCommandChannel('guild-categorized-channel'), '1568088123039027220')
})

test('set-channel uses the parent text channel when run in a thread', async () => {
    const { interaction } = makeInteraction(
        'guild-thread-setting',
        'thread-id',
        true,
        true,
        'parent-channel-id',
    )

    await SetChannel.run({} as never, interaction as never)

    assert.equal(core.getCommandChannel('guild-thread-setting'), 'parent-channel-id')
})

test('set-channel replaces an existing channel setting', async () => {
    core.setCommandChannel('guild-channel-two', 'channel-old')
    const { interaction } = makeInteraction('guild-channel-two', 'channel-new')

    await SetChannel.run({} as never, interaction as never)

    assert.equal(core.getCommandChannel('guild-channel-two'), 'channel-new')
})

test('set-channel requires Administrator permission', async () => {
    const { interaction, replies } = makeInteraction('guild-no-admin', 'channel-1', false)

    await SetChannel.run({} as never, interaction as never)

    assert.equal(core.getCommandChannel('guild-no-admin'), null)
    assert.match(embedJson(replies[0]).description, /administrators/)
})
