import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { MessageFlags } from 'discord.js'
import { cleanup, loadCommand } from './helpers.js'

const { Help } = await loadCommand('help')

afterAll(cleanup)

test('help lists registered command usage in an ephemeral reply', async () => {
    const replies: any[] = []
    const interaction = {
        reply: async (payload: any) => replies.push(payload),
    }

    await Help.run({} as never, interaction as never)

    assert.equal(replies.length, 1)
    assert.equal(replies[0].flags, MessageFlags.Ephemeral)

    const fields = replies[0].embeds[0].toJSON().fields
    assert.deepEqual(fields.filter((field: { name: string }) => field.name !== '\u200b').map((field: { name: string }) => field.name), [
        'Run Management',
        'Character Profiles',
        'History',
        'Bot Settings',
        'Help',
    ])
    assert.equal(fields.filter((field: { name: string }) => field.name === '\u200b').length, 4)
    assert.match(fields[0].value, /\*\*\/start/)
    assert.match(fields[6].value, /\*\*\/set-channel\*\*/)
    assert.match(fields[8].value, /\*\*\/help\*\*/)
})