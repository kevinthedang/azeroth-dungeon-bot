import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { Collection } from 'discord.js'
import { cleanup, loadCommand, loadCore } from './helpers.js'

const core = await loadCore()
const { SetName } = await loadCommand('setName')
const { ClearName } = await loadCommand('clearName')
const { SetRole } = await loadCommand('setRole')
const { SetSprite } = await loadCommand('setSprite')
const { ClearSprite } = await loadCommand('clearSprite')

afterAll(cleanup)

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
            fetch: async (userId: string) => {
                const member = cache.get(userId)
                if (!member) throw new Error('Unknown Member')
                return member
            },
        },
    }
}

interface InteractionOptions {
    guild?: ReturnType<typeof makeGuild> | null
    user?: ReturnType<typeof makeUser>
    strings?: Record<string, string>
    users?: Record<string, ReturnType<typeof makeUser>>
}

function makeInteraction(options: InteractionOptions = {}) {
    const guild = options.guild === undefined ? makeGuild('guild-default') : options.guild
    const user = options.user ?? makeUser('self')
    const replies: any[] = []
    const calls: string[] = []

    const interaction = {
        guild,
        guildId: guild?.id ?? null,
        channelId: 'channel-1',
        user,
        memberPermissions: null,
        options: {
            getString: (name: string) => options.strings?.[name] ?? null,
            getUser: (name: string) => options.users?.[name] ?? null,
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

function embedJson(reply: any) {
    return reply?.embeds?.[0]?.toJSON()
}

test('set-name succeeds for the caller', async () => {
    const self = makeMember('self', 'kevin')
    const guild = makeGuild('guild-set-name-self', [self])
    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        strings: { name: 'Thrall' },
    })

    await SetName.run({} as never, interaction as never)

    assert.equal(core.getPlayerName(guild.id, 'self'), 'Thrall')
    const json = embedJson(replies[0])
    assert.equal(json.title, 'Character name updated')
    assert.equal(json.color, 0x57f287)
    assert.match(json.description, /Thrall/)
})

test('set-name can target another guild member', async () => {
    const self = makeMember('admin')
    const target = makeMember('target', 'alice')
    const guild = makeGuild('guild-set-name-other', [self, target])
    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        strings: { name: "Zul'jin" },
        users: { user: target.user },
    })

    await SetName.run({} as never, interaction as never)

    assert.equal(core.getPlayerName(guild.id, 'target'), "Zul'jin")
    assert.match(embedJson(replies[0]).description, /<@target> will now show \*\*Zul'jin\*\*/)
})

test('set-name rejects invalid names without storing anything', async () => {
    const self = makeMember('self')
    const guild = makeGuild('guild-set-name-invalid', [self])
    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        strings: { name: 'x' },
    })

    await SetName.run({} as never, interaction as never)

    assert.equal(core.getPlayerName(guild.id, 'self'), null)
    const json = embedJson(replies[0])
    assert.equal(json.title, 'Invalid character name')
    assert.equal(json.color, 0xed4245)
    assert.match(json.description, /not a valid character name/)
})

test('set-name rejects users who are not in the server', async () => {
    const self = makeMember('self')
    const guild = makeGuild('guild-set-name-ghost', [self])
    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        strings: { name: 'Thrall' },
        users: { user: makeUser('ghost') },
    })

    await SetName.run({} as never, interaction as never)

    assert.equal(core.getPlayerName(guild.id, 'ghost'), null)
    assert.match(embedJson(replies[0]).description, /not in this server/)
})

test('set-name refuses to run outside a guild', async () => {
    const { interaction, replies } = makeInteraction({ guild: null })

    await SetName.run({} as never, interaction as never)

    assert.equal(embedJson(replies[0]).color, 0xed4245)
    assert.match(embedJson(replies[0]).description, /only be used inside a server/)
})

test('clear-name removes an existing name', async () => {
    const self = makeMember('self')
    const guild = makeGuild('guild-clear-name', [self])
    core.setPlayerName(guild.id, 'self', 'Thrall')

    const { interaction, replies } = makeInteraction({ guild, user: self.user })

    await ClearName.run({} as never, interaction as never)

    assert.equal(core.getPlayerName(guild.id, 'self'), null)
    const json = embedJson(replies[0])
    assert.equal(json.title, 'Character name cleared')
    assert.equal(json.color, 0x57f287)
    assert.match(json.description, /Run cards will use your Discord name again/)
})

test('clear-name reports when there was nothing to clear', async () => {
    const self = makeMember('self')
    const guild = makeGuild('guild-clear-name-empty', [self])
    const { interaction, replies } = makeInteraction({ guild, user: self.user })

    await ClearName.run({} as never, interaction as never)

    const json = embedJson(replies[0])
    assert.equal(json.color, 0x95a5a6)
    assert.match(json.description, /do not have a character name set/)
})

test('clear-name can target another guild member', async () => {
    const self = makeMember('admin')
    const target = makeMember('target', 'alice')
    const guild = makeGuild('guild-clear-name-other', [self, target])
    core.setPlayerName(guild.id, 'target', 'Jaina')

    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        users: { user: target.user },
    })

    await ClearName.run({} as never, interaction as never)

    assert.equal(core.getPlayerName(guild.id, 'target'), null)
    assert.match(embedJson(replies[0]).description, /<@target>'s character name was cleared/)
})

test('clear-name refuses to run outside a guild', async () => {
    const { interaction, replies } = makeInteraction({ guild: null })

    await ClearName.run({} as never, interaction as never)

    assert.match(embedJson(replies[0]).description, /only be used inside a server/)
})

test('set-role stores a valid role', async () => {
    const self = makeMember('self')
    const guild = makeGuild('guild-set-role', [self])
    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        strings: { role: 'Tank' },
    })

    await SetRole.run({} as never, interaction as never)

    assert.equal(core.getPlayerRole(guild.id, 'self'), 'Tank')
    assert.equal(embedJson(replies[0]).title, 'Role updated')
    assert.match(embedJson(replies[0]).description, /Tank/)
})

test('set-role rejects an unknown role', async () => {
    const self = makeMember('self')
    const guild = makeGuild('guild-set-role-bad', [self])
    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        strings: { role: 'Wizard' },
    })

    await SetRole.run({} as never, interaction as never)

    assert.equal(core.getPlayerRole(guild.id, 'self'), null)
    assert.match(embedJson(replies[0]).description, /Choose one of/)
})

test('set-role can target another guild member', async () => {
    const self = makeMember('admin')
    const target = makeMember('target', 'alice')
    const guild = makeGuild('guild-set-role-other', [self, target])
    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        strings: { role: 'Healer' },
        users: { user: target.user },
    })

    await SetRole.run({} as never, interaction as never)

    assert.equal(core.getPlayerRole(guild.id, 'target'), 'Healer')
    assert.match(embedJson(replies[0]).description, /<@target> is now \*\*Healer\*\*/)
})

test('set-sprite stores a valid sprite', async () => {
    const self = makeMember('self')
    const guild = makeGuild('guild-set-sprite', [self])
    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        strings: { sprite: 'female_tauren' },
    })

    await SetSprite.run({} as never, interaction as never)

    assert.equal(core.getPlayerSprite(guild.id, 'self'), 'female_tauren')
    assert.equal(embedJson(replies[0]).title, 'Sprite updated')
    assert.match(embedJson(replies[0]).description, /Female Tauren/)
})

test('set-sprite rejects an unknown sprite', async () => {
    const self = makeMember('self')
    const guild = makeGuild('guild-set-sprite-bad', [self])
    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        strings: { sprite: 'male_orc' },
    })

    await SetSprite.run({} as never, interaction as never)

    assert.equal(core.getPlayerSprite(guild.id, 'self'), null)
    assert.match(embedJson(replies[0]).description, /Choose a valid character sprite/)
})

test('clear-sprite removes an existing sprite', async () => {
    const self = makeMember('self')
    const guild = makeGuild('guild-clear-sprite', [self])
    core.setPlayerSprite(guild.id, 'self', 'female_tauren')

    const { interaction, replies } = makeInteraction({ guild, user: self.user })

    await ClearSprite.run({} as never, interaction as never)

    assert.equal(core.getPlayerSprite(guild.id, 'self'), null)
    assert.equal(embedJson(replies[0]).title, 'Sprite cleared')
    assert.match(embedJson(replies[0]).description, /sprite was cleared/)
})

test('clear-sprite reports when there was nothing to clear', async () => {
    const self = makeMember('self')
    const guild = makeGuild('guild-clear-sprite-empty', [self])
    const { interaction, replies } = makeInteraction({ guild, user: self.user })

    await ClearSprite.run({} as never, interaction as never)

    assert.equal(embedJson(replies[0]).color, 0x95a5a6)
    assert.match(embedJson(replies[0]).description, /do not have a character sprite set/)
})

test('clear-sprite can target another guild member', async () => {
    const self = makeMember('admin')
    const target = makeMember('target', 'alice')
    const guild = makeGuild('guild-clear-sprite-other', [self, target])
    core.setPlayerSprite(guild.id, 'target', 'female_tauren')

    const { interaction, replies } = makeInteraction({
        guild,
        user: self.user,
        users: { user: target.user },
    })

    await ClearSprite.run({} as never, interaction as never)

    assert.equal(core.getPlayerSprite(guild.id, 'target'), null)
    assert.match(embedJson(replies[0]).description, /<@target>'s WoW character sprite was cleared/)
})
