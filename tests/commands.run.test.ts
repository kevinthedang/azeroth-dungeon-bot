import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { Collection } from 'discord.js'
import { cleanup, loadCommand, loadCore } from './helpers.js'

const core = await loadCore()
const { Start } = await loadCommand('start')
const { Stop } = await loadCommand('stop')
const { ExtraNote } = await loadCommand('extraNote')
const { Drop } = await loadCommand('drop')

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
    booleans?: Record<string, boolean>
    userOption?: ReturnType<typeof makeUser> | null
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
            getBoolean: (name: string) => options.booleans?.[name] ?? null,
            getUser: () => options.userOption ?? null,
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

test('extra-note reports when there is no active run', async () => {
    const { interaction, replies } = makeInteraction({
        channelId: unique('channel'),
        strings: { text: 'Bring a flask' },
    })

    await ExtraNote.run({} as never, interaction as never)

    assert.match(embedJson(replies[0]).description, /no active run/)
})

test('extra-note appends notes and updates the timer embed', async () => {
    const guild = makeGuild('guild-extra-note', [])
    const channel = unique('channel')
    const run = core.startRun(guild.id, channel, 'The Deadmines')
    core.attachMessage(run.id, 'timer-message')

    const { message, edits } = makeMessage()
    const first = makeInteraction({
        channelId: channel,
        strings: { text: 'Bring a flask' },
    })
    await ExtraNote.run(makeClient(message) as never, first.interaction as never)

    const second = makeInteraction({
        channelId: channel,
        strings: { text: 'Need a healer' },
    })
    await ExtraNote.run(makeClient(message) as never, second.interaction as never)

    assert.deepEqual(core.getRunNotes(run.id), ['Bring a flask', 'Need a healer'])
    assert.equal(edits.length, 2)

    const json = embedJson(edits[1])
    const notesField = json.fields.find((field: { name: string }) => field.name === '📝 Extra Notes')
    assert.equal(notesField.value, '• Bring a flask\n• Need a healer')
    assert.equal(first.calls.includes('deleteReply'), true)
    assert.equal(second.calls.includes('deleteReply'), true)
})

test('drop requires a party member when not vendored', async () => {
    const channel = unique('channel')
    core.startRun(unique('guild'), channel, 'The Deadmines')

    const { interaction, replies } = makeInteraction({
        channelId: channel,
        strings: { item: 'Ruby Ring' },
        booleans: { vendored: false },
    })

    await Drop.run({} as never, interaction as never)

    assert.match(embedJson(replies[0]).description, /party member/)
})

test('drop records a vendored item and non-vendored party allocation', async () => {
    const channel = unique('channel')
    const run = core.startRun(
        unique('guild'),
        channel,
        'The Deadmines',
        [{ userId: 'member-1', username: 'alice' }],
    )
    core.attachMessage(run.id, 'timer-message')

    const { message, edits } = makeMessage()
    const vendored = makeInteraction({
        channelId: channel,
        strings: { item: 'Old Belt' },
        booleans: { vendored: true },
    })
    await Drop.run(makeClient(message) as never, vendored.interaction as never)

    const allocated = makeInteraction({
        channelId: channel,
        strings: { item: 'Ruby Ring' },
        booleans: { vendored: false },
        userOption: makeUser('member-1', 'alice'),
    })
    await Drop.run(makeClient(message) as never, allocated.interaction as never)

    assert.deepEqual(core.getRunDrops(run.id), [
        { item: 'Old Belt', vendored: true, memberId: null, memberName: null },
        { item: 'Ruby Ring', vendored: false, memberId: 'member-1', memberName: 'alice' },
    ])
    assert.equal(edits.length, 2)

    const json = embedJson(edits[1])
    const dropsField = json.fields.find((field: { name: string }) => field.name === '📦 Drops')
    assert.equal(dropsField.value, '• Old Belt — Vendored\n• Ruby Ring — <@member-1>')
})
