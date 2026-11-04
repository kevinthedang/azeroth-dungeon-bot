import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { Collection } from 'discord.js'
import { cleanup, loadCommand, loadCore } from './helpers.js'

const core = await loadCore()
const { Start } = await loadCommand('start')
const { Stop } = await loadCommand('stop')

afterAll(cleanup)

let idCounter = 0
function unique(prefix: string): string {
    return `${prefix}-${++idCounter}`
}

function makeUser(id: string, username = `user${id}`) {
    return { id, username, globalName: null }
}

function makeMember(id: string, username = `user${id}`) {
    return {
        id,
        user: makeUser(id, username),
        displayName: username,
        nickname: null,
    }
}

function makeGuild(id: string, members: ReturnType<typeof makeMember>[] = []) {
    const cache = new Collection<string, ReturnType<typeof makeMember>>()
    for (const member of members) cache.set(member.id, member)

    return {
        id,
        members: {
            cache,
            fetch: async (userId?: string) => {
                if (userId === undefined) return cache
                const member = cache.get(userId)
                if (!member) throw new Error('Unknown Member')
                return member
            },
        },
    }
}

function makeInteraction(options: {
    guild?: ReturnType<typeof makeGuild> | null
    user?: ReturnType<typeof makeUser>
    channelId?: string
    strings?: Record<string, string>
} = {}) {
    const guild = options.guild === undefined ? makeGuild('guild-default') : options.guild
    const user = options.user ?? makeUser('self')
    const replies: any[] = []
    const calls: string[] = []

    const interaction = {
        guild,
        guildId: guild?.id ?? null,
        channelId: options.channelId ?? 'channel-1',
        user,
        memberPermissions: null,
        options: {
            getString: (name: string) => options.strings?.[name] ?? null,
            getUser: () => null,
        },
        deferReply: async () => {
            calls.push('deferReply')
        },
        editReply: async (payload: any) => {
            replies.push(payload)
            return { id: `reply-${replies.length}` }
        },
        deleteReply: async () => {
            calls.push('deleteReply')
        },
        followUp: async (payload: any) => {
            replies.push(payload)
            return { id: `followup-${replies.length}` }
        },
    }

    return { interaction, replies, calls }
}

function embedJson(payload: any) {
    return payload?.embeds?.[0]?.toJSON()
}

function makeMessage() {
    const edits: any[] = []
    const message: any = {
        id: 'timer-message',
        attachments: { first: () => ({ name: 'run-card.png' }) },
        edit: async (payload: any) => {
            edits.push(payload)
            return message
        },
    }

    return { message, edits }
}

function makeClient(message: any, options: { failChannel?: boolean } = {}) {
    return {
        channels: {
            fetch: async () => {
                if (options.failChannel) return null
                return {
                    isTextBased: () => true,
                    messages: {
                        fetch: async () => message,
                    },
                }
            },
        },
    }
}

test('start refuses to run outside a guild', async () => {
    const { interaction, replies } = makeInteraction({ guild: null })

    await Start.run({} as never, interaction as never)

    assert.match(embedJson(replies[0]).description, /only be used inside a server/)
})

test('start refuses when the channel already has a live run', async () => {
    const guild = makeGuild('guild-start-active', [makeMember('1', 'alice')])
    const channel = unique('channel')
    core.startRun(guild.id, channel, 'The Deadmines')

    const { interaction, replies } = makeInteraction({
        guild,
        channelId: channel,
        strings: { dungeon: 'Moon Brook', members: '' },
    })

    await Start.run({} as never, interaction as never)

    assert.equal(embedJson(replies[0]).title, 'Run already in progress')
    assert.match(embedJson(replies[0]).description, /Use `\/stop` first/)
})

test('start rejects unknown party members without creating a run', async () => {
    const guild = makeGuild('guild-start-unknown', [makeMember('1', 'alice')])
    const channel = unique('channel')

    const { interaction, replies } = makeInteraction({
        guild,
        channelId: channel,
        strings: { dungeon: 'The Deadmines', members: 'alice, ghost' },
    })

    await Start.run({} as never, interaction as never)

    assert.equal(core.getActiveRun(channel), undefined)
    const json = embedJson(replies[0])
    assert.equal(json.title, 'Could not add everyone to the party')
    assert.match(json.description, /Not in this server: `ghost`/)
})

test('start rejects ambiguous party members', async () => {
    const guild = makeGuild('guild-start-ambiguous', [
        makeMember('1', 'bob-one'),
        makeMember('2', 'bob-two'),
    ])
    guild.members.cache.get('1')!.displayName = 'Bob'
    guild.members.cache.get('2')!.displayName = 'Bob'
    const channel = unique('channel')

    const { interaction, replies } = makeInteraction({
        guild,
        channelId: channel,
        strings: { dungeon: 'The Deadmines', members: 'bob' },
    })

    await Start.run({} as never, interaction as never)

    assert.equal(core.getActiveRun(channel), undefined)
    assert.match(embedJson(replies[0]).description, /Matched more than one member: `bob`/)
})

test('start creates the run, stores the party, and attaches the card', async () => {
    const guild = makeGuild('guild-start-ok', [
        makeMember('1', 'alice'),
        makeMember('2', 'bob'),
    ])
    const channel = unique('channel')

    const { interaction, replies } = makeInteraction({
        guild,
        channelId: channel,
        strings: { dungeon: 'The Deadmines', members: 'alice, <@2>' },
    })

    await Start.run({} as never, interaction as never)

    const run = core.getActiveRun(channel)
    assert.ok(run)
    assert.equal(run.dungeon, 'The Deadmines')
    assert.deepEqual(
        core.getRunMembers(run.id).map(member => member.username),
        ['alice', 'bob'],
    )
    assert.equal(run.messageId, 'reply-1')

    const payload = replies[0]
    assert.equal(payload.files.length, 1)
    assert.equal(payload.files[0].name, 'run-card.png')
    assert.deepEqual(payload.allowedMentions, { parse: [] })

    const json = embedJson(payload)
    assert.equal(json.title, '⏱️ The Deadmines')
    assert.equal(json.image?.url, 'attachment://run-card.png')
})

test('start falls back to "Dungeon" for a blank name and allows an empty party', async () => {
    const guild = makeGuild('guild-start-fallback', [])
    const channel = unique('channel')

    const { interaction, replies } = makeInteraction({
        guild,
        channelId: channel,
        strings: { dungeon: '   ', members: '' },
    })

    await Start.run({} as never, interaction as never)

    const run = core.getActiveRun(channel)
    assert.equal(run?.dungeon, 'Dungeon')
    assert.deepEqual(core.getRunMembers(run!.id), [])
    assert.equal(embedJson(replies[0]).title, '⏱️ Dungeon')
})

test('stop reports when there is no active run', async () => {
    const { interaction, replies, calls } = makeInteraction({ channelId: unique('channel') })

    await Stop.run({} as never, interaction as never)

    assert.match(embedJson(replies[0]).description, /no active run/)
    assert.ok(!calls.includes('deleteReply'))
})

test('stop finishes the run and updates the timer message without an extra reply', async () => {
    const guild = makeGuild('guild-stop-ok', [])
    const channel = unique('channel')
    const run = core.startRun(guild.id, channel, 'The Deadmines')
    core.attachMessage(run.id, 'timer-message')

    const { message, edits } = makeMessage()
    const { interaction, replies, calls } = makeInteraction({ channelId: channel })

    await Stop.run(makeClient(message) as never, interaction as never)

    assert.equal(core.getActiveRun(channel), undefined)
    assert.equal(edits.length, 1)

    const json = embedJson(edits[0])
    assert.equal(json.title, '🏁 The Deadmines')
    assert.match(json.description, /Finished in/)
    assert.match(json.footer.text, /First recorded run/)

    assert.ok(calls.includes('deleteReply'))
    assert.equal(replies.length, 0)
})

test('stop reports when the timer message cannot be updated', async () => {
    const guild = makeGuild('guild-stop-fail', [])
    const channel = unique('channel')
    const run = core.startRun(guild.id, channel, 'The Deadmines')
    core.attachMessage(run.id, 'timer-message')

    const { message } = makeMessage()
    const { interaction, replies, calls } = makeInteraction({ channelId: channel })

    await Stop.run(
        makeClient(message, { failChannel: true }) as never,
        interaction as never,
    )

    assert.equal(core.getActiveRun(channel), undefined)
    assert.match(embedJson(replies[0]).description, /could not be updated/)
    assert.ok(!calls.includes('deleteReply'))
})
