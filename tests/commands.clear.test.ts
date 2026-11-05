import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { PermissionFlagsBits } from 'discord.js'
import { cleanup, loadCommand, loadCore } from './helpers.js'

const core = await loadCore()
const { Clear } = await loadCommand('clear')

afterAll(cleanup)

let idCounter = 0
function unique(prefix: string): string {
    return `${prefix}-${++idCounter}`
}

function makeInteraction(options: {
    guildId?: string | null
    canManage?: boolean
    dungeon?: string
} = {}) {
    const replies: any[] = []

    const interaction = {
        guildId: options.guildId === undefined ? 'guild-clear-command' : options.guildId,
        memberPermissions: {
            has: (permission: bigint) =>
                permission === PermissionFlagsBits.ManageGuild && options.canManage === true,
        },
        options: {
            getString: (name: string) => (name === 'dungeon' ? options.dungeon ?? null : null),
        },
        deferReply: async () => undefined,
        editReply: async (payload: any) => {
            replies.push(payload)
            return { id: `reply-${replies.length}` }
        },
    }

    return { interaction, replies }
}

function embedJson(reply: any) {
    return reply?.embeds?.[0]?.toJSON()
}

function addFinishedRun(guildId: string, dungeon: string, elapsedMs: number): number {
    const run = core.startRun(guildId, unique('channel'), dungeon)
    core.db
        .prepare('UPDATE runs SET started_at = ?, ended_at = ?, status = ? WHERE id = ?')
        .run(1_700_000_000_000, 1_700_000_000_000 + elapsedMs, 'finished', run.id)
    return run.id
}

test('clear refuses to run outside a guild', async () => {
    const { interaction, replies } = makeInteraction({ guildId: null, dungeon: 'The Deadmines' })

    await Clear.run({} as never, interaction as never)

    assert.match(embedJson(replies[0]).description, /only be used inside a server/)
})

test('clear requires Manage Server', async () => {
    const { interaction, replies } = makeInteraction({
        canManage: false,
        dungeon: 'The Deadmines',
    })

    await Clear.run({} as never, interaction as never)

    assert.match(embedJson(replies[0]).description, /Manage Server/)
})

test('clear requires a dungeon name', async () => {
    const { interaction, replies } = makeInteraction({ canManage: true, dungeon: '   ' })

    await Clear.run({} as never, interaction as never)

    assert.match(embedJson(replies[0]).description, /provide the name of the dungeon/)
})

test('clear reports when there is nothing to delete', async () => {
    const guildId = unique('guild')
    const { interaction, replies } = makeInteraction({
        guildId,
        canManage: true,
        dungeon: 'The Deadmines',
    })

    await Clear.run({} as never, interaction as never)

    const json = embedJson(replies[0])
    assert.equal(json.title, 'Nothing to clear')
    assert.match(json.description, /No recorded history found/)
})

test('clear deletes history and leaves active runs untouched', async () => {
    const guildId = unique('guild')
    addFinishedRun(guildId, 'The Deadmines', 100_000)
    addFinishedRun(guildId, 'The Deadmines', 200_000)

    const activeChannel = unique('active-channel')
    core.startRun(guildId, activeChannel, 'The Deadmines')

    const { interaction, replies } = makeInteraction({
        guildId,
        canManage: true,
        dungeon: 'The Deadmines',
    })

    await Clear.run({} as never, interaction as never)

    const json = embedJson(replies[0])
    assert.equal(json.title, '🧹 Dungeon history cleared')
    assert.match(json.description, /Cleared `2` completed runs for \*\*The Deadmines\*\*/)
    assert.match(json.description, /`1` run is still in progress and was left untouched/)
    assert.ok(core.getActiveRun(activeChannel))
    assert.equal(core.getPersonalBest(guildId, 'The Deadmines'), null)
})
