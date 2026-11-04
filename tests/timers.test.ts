import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { cleanup, loadCore } from './helpers.js'

const core = await loadCore()

afterAll(cleanup)

let idCounter = 0
function unique(prefix: string): string {
    return `${prefix}-${++idCounter}`
}

const STARTED_AT = 1_700_000_000_000

function makeRun(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 7,
        guildId: 'guild-card',
        channelId: 'channel-card',
        dungeon: 'The Deadmines',
        startedAt: STARTED_AT,
        endedAt: null,
        pausedTotal: 0,
        pausedAt: null,
        status: 'running',
        messageId: null,
        ...overrides,
    }
}

function addRun(
    guildId: string,
    dungeon: string,
    elapsedMs: number,
    options: { pausedTotal?: number; status?: string } = {},
) {
    const pausedTotal = options.pausedTotal ?? 0
    const status = options.status ?? 'finished'
    const run = core.startRun(guildId, unique('history-channel'), dungeon, [])

    core.db
        .prepare(`
            UPDATE runs
            SET started_at = ?, ended_at = ?, paused_total = ?, status = ?
            WHERE id = ?
        `)
        .run(STARTED_AT, STARTED_AT + elapsedMs + pausedTotal, pausedTotal, status, run.id)

    return run.id
}

test('startRun creates a running run with its party in order', () => {
    const guild = unique('guild')
    const channel = unique('channel')
    const before = Date.now()

    const run = core.startRun(guild, channel, 'The Deadmines', [
        { userId: '2', username: 'alice' },
        { userId: '1', username: 'kev' },
    ])

    assert.equal(run.status, 'running')
    assert.equal(run.pausedTotal, 0)
    assert.equal(run.pausedAt, null)
    assert.equal(run.endedAt, null)
    assert.equal(run.messageId, null)
    assert.ok(run.startedAt >= before && run.startedAt <= Date.now())

    const members = core.getRunMembers(run.id)
    assert.deepEqual(members.map(member => member.userId), ['2', '1'])
    assert.deepEqual(members.map(member => member.username), ['alice', 'kev'])
})

test('run numbers are independent for each dungeon in a guild', () => {
    const guild = unique('guild-run-count')
    const deadmines1 = core.startRun(guild, unique('channel'), 'The Deadmines')
    const moonbrook1 = core.startRun(guild, unique('channel'), 'Moon Brook')
    const deadmines2 = core.startRun(guild, unique('channel'), 'The Deadmines')
    const moonbrook2 = core.startRun(guild, unique('channel'), 'Moon Brook')

    assert.equal(core.getDungeonRunNumber(deadmines1), 1)
    assert.equal(core.getDungeonRunNumber(moonbrook1), 1)
    assert.equal(core.getDungeonRunNumber(deadmines2), 2)
    assert.equal(core.getDungeonRunNumber(moonbrook2), 2)
})

test('getActiveRun and getActiveRuns see the live run', () => {
    const guild = unique('guild')
    const channel = unique('channel')
    const run = core.startRun(guild, channel, 'The Deadmines')

    assert.equal(core.getActiveRun(channel)?.id, run.id)
    assert.ok(core.getActiveRuns().some(active => active.id === run.id))
    assert.equal(core.getActiveRun(unique('missing-channel')), undefined)

    core.attachMessage(run.id, 'message-123')
    assert.equal(core.getActiveRun(channel)?.messageId, 'message-123')
})

test('getRunMembers joins the live role, sprite, and WoW name', () => {
    const guild = unique('guild')
    const channel = unique('channel')
    const run = core.startRun(guild, channel, 'The Deadmines', [
        { userId: '1', username: 'kev' },
        { userId: '2', username: 'alice' },
    ])

    core.setPlayerRole(guild, '1', 'Tank')
    core.setPlayerSprite(guild, '1', 'female_tauren')
    core.setPlayerName(guild, '1', 'Thrall')

    const [kev, alice] = core.getRunMembers(run.id)

    assert.equal(kev?.username, 'kev')
    assert.equal(kev?.role, 'Tank')
    assert.equal(kev?.sprite, 'female_tauren')
    assert.equal(kev?.wowName, 'Thrall')

    assert.equal(alice?.username, 'alice')
    assert.equal(alice?.role, null)
    assert.equal(alice?.sprite, null)
    assert.equal(alice?.wowName, null)
})

test('getRunMembers ignores unknown stored role and sprite keys', () => {
    const guild = unique('guild')
    const channel = unique('channel')
    const run = core.startRun(guild, channel, 'The Deadmines', [
        { userId: '1', username: 'kev' },
    ])

    core.db
        .prepare('UPDATE player_roles SET role = ? WHERE guild_id = ? AND user_id = ?')
        .run('Wizard', guild, '1')
    core.db
        .prepare('UPDATE player_sprites SET sprite = ? WHERE guild_id = ? AND user_id = ?')
        .run('male_orc', guild, '1')

    const [member] = core.getRunMembers(run.id)
    assert.equal(member?.role, null)
    assert.equal(member?.sprite, null)
})

test('a channel can only have one live run at a time', () => {
    const guild = unique('guild')
    const channel = unique('channel')

    core.startRun(guild, channel, 'The Deadmines')

    assert.throws(
        () => core.startRun(guild, channel, 'The Deadmines'),
        /UNIQUE/i,
    )

    core.finishRun(channel)

    const next = core.startRun(guild, channel, 'The Deadmines')
    assert.ok(next.id > 0)
})

test('finishRun stores the result and clears the channel', () => {
    const guild = unique('guild')
    const channel = unique('channel')
    const run = core.startRun(guild, channel, 'The Deadmines')

    const finished = core.finishRun(channel)

    assert.equal(finished?.id, run.id)
    assert.equal(finished?.status, 'finished')
    assert.equal(finished?.pausedAt, null)
    assert.ok(typeof finished?.endedAt === 'number')
    assert.equal(core.getActiveRun(channel), undefined)
    assert.equal(core.finishRun(channel), null)
})

test('pauseRun and resumeRun move between states', () => {
    const guild = unique('guild')
    const channel = unique('channel')
    const run = core.startRun(guild, channel, 'The Deadmines')

    const paused = core.pauseRun(channel)
    assert.equal(paused?.status, 'paused')
    assert.ok(typeof paused?.pausedAt === 'number')
    assert.equal(core.pauseRun(channel), null)

    core.db
        .prepare('UPDATE runs SET paused_at = ? WHERE id = ?')
        .run(Date.now() - 5_000, run.id)

    const resumed = core.resumeRun(channel)
    assert.equal(resumed?.status, 'running')
    assert.equal(resumed?.pausedAt, null)
    assert.ok((resumed?.pausedTotal ?? 0) >= 5_000)
    assert.equal(core.resumeRun(channel), null)
})

test('finishRun includes an active pause in pausedTotal', () => {
    const guild = unique('guild')
    const channel = unique('channel')
    const run = core.startRun(guild, channel, 'The Deadmines')

    core.pauseRun(channel)
    core.db
        .prepare('UPDATE runs SET paused_at = ? WHERE id = ?')
        .run(Date.now() - 3_000, run.id)

    const finished = core.finishRun(channel)
    assert.ok((finished?.pausedTotal ?? 0) >= 3_000)
    assert.equal(finished?.pausedAt, null)
})

test('pauseRun and resumeRun do nothing without a matching run', () => {
    assert.equal(core.pauseRun(unique('channel')), null)
    assert.equal(core.resumeRun(unique('channel')), null)
})

test('addRunMember adds members once and leaves existing members unchanged', () => {
    const run = core.startRun(unique('guild'), unique('channel'), 'The Deadmines')

    assert.equal(core.addRunMember(run.id, { userId: 'member-1', username: 'alice' }), true)
    assert.equal(core.addRunMember(run.id, { userId: 'member-1', username: 'alice' }), false)
    assert.deepEqual(core.getRunMembers(run.id).map(member => member.username), ['alice'])
})

test('removeRunMember removes only the selected party member', () => {
    const run = core.startRun(
        unique('guild'),
        unique('channel'),
        'The Deadmines',
        [
            { userId: 'member-1', username: 'alice' },
            { userId: 'member-2', username: 'bob' },
        ],
    )

    assert.equal(core.removeRunMember(run.id, 'member-1'), true)
    assert.equal(core.removeRunMember(run.id, 'member-1'), false)
    assert.deepEqual(core.getRunMembers(run.id).map(member => member.username), ['bob'])
})

test('run notes are appended and stored per run', () => {
    const channel = unique('channel')
    const run = core.startRun(unique('guild'), channel, 'The Deadmines')

    core.addRunNote(run.id, 'Bring a flask')
    core.addRunNote(run.id, 'Need a healer')

    assert.deepEqual(core.getRunNotes(run.id), ['Bring a flask', 'Need a healer'])
})

test('run drops are stored with vendored and party recipient state', () => {
    const channel = unique('channel')
    const run = core.startRun(
        unique('guild'),
        channel,
        'The Deadmines',
        [{ userId: 'member-1', username: 'alice' }],
    )

    core.addRunDrop(run.id, 'The Deadmines', 'Old Belt', true)
    core.addRunDrop(run.id, 'Edwin VanCleef', 'Ruby Ring', false, {
        userId: 'member-1',
        username: 'alice',
    })

    assert.deepEqual(core.getRunDrops(run.id), [
        { boss: 'The Deadmines', item: 'Old Belt', vendored: true, memberId: null, memberName: null },
        { boss: 'Edwin VanCleef', item: 'Ruby Ring', vendored: false, memberId: 'member-1', memberName: 'alice' },
    ])
})

test('getElapsedMs excludes paused time', () => {
    const running = makeRun()
    assert.equal(core.getElapsedMs(running, STARTED_AT + 10_000), 10_000)

    const previouslyPaused = makeRun({ pausedTotal: 2_000 })
    assert.equal(core.getElapsedMs(previouslyPaused, STARTED_AT + 10_000), 8_000)

    const paused = makeRun({ pausedAt: STARTED_AT + 9_000 })
    assert.equal(core.getElapsedMs(paused, STARTED_AT + 10_000), 9_000)

    const finished = makeRun({ status: 'finished', endedAt: STARTED_AT + 8_000, pausedTotal: 2_000 })
    assert.equal(core.getElapsedMs(finished, STARTED_AT + 100_000), 6_000)

    assert.equal(core.getElapsedMs(makeRun(), STARTED_AT - 5_000), 0)
})

test('formatElapsed always renders HH:MM:SS', () => {
    assert.equal(core.formatElapsed(0), '00:00:00')
    assert.equal(core.formatElapsed(999), '00:00:00')
    assert.equal(core.formatElapsed(1_000), '00:00:01')
    assert.equal(core.formatElapsed(61_000), '00:01:01')
    assert.equal(core.formatElapsed(3_661_000), '01:01:01')
    assert.equal(core.formatElapsed(36_000_000), '10:00:00')
    assert.equal(core.formatElapsed(-5_000), '00:00:00')
})

test('formatPacificTime is DST-aware', () => {
    const winter = core.formatPacificTime(Date.UTC(2024, 0, 15, 20, 0))
    const summer = core.formatPacificTime(Date.UTC(2024, 6, 15, 19, 0))

    assert.match(winter, /12:00\sPM\sPST/)
    assert.match(summer, /12:00\sPM\sPDT/)
})

test('getPersonalBest finds the fastest finished run, case-insensitively', () => {
    const guild = unique('guild')

    const slow = addRun(guild, 'The Deadmines', 900_000)
    const best = addRun(guild, 'The Deadmines', 600_000)
    addRun(guild, 'The Deadmines', 300_000, { status: 'cancelled' })
    addRun(guild, 'The Deadmines', 100_000, { status: 'running' })

    assert.equal(core.getPersonalBest(guild, 'The Deadmines'), 600_000)
    assert.equal(core.getPersonalBest(guild, 'the deadmines'), 600_000)
    assert.equal(core.getPersonalBest(guild, 'THE DEADMINES'), 600_000)
    assert.equal(core.getPersonalBest(guild, 'The Deadmines', best), 900_000)
    assert.equal(core.getPersonalBest(guild, 'The Deadmines', slow), 600_000)

    assert.equal(core.getPersonalBest(unique('guild'), 'The Deadmines'), null)
    assert.equal(core.getPersonalBest(guild, 'Moon Brook'), null)
})

test('getPersonalBest subtracts paused time', () => {
    const guild = unique('guild')
    const run = addRun(guild, 'Paused Dungeon', 500_000, { pausedTotal: 120_000 })

    assert.equal(core.getPersonalBest(guild, 'Paused Dungeon'), 500_000)

    core.db
        .prepare('UPDATE runs SET status = ? WHERE id = ?')
        .run('cancelled', run)

    assert.equal(core.getPersonalBest(guild, 'Paused Dungeon'), null)
})

test('clearHistory removes finished and cancelled runs but keeps active ones', () => {
    const guild = unique('guild')
    const activeChannel = unique('active-channel')

    addRun(guild, 'Moon Brook', 100_000)
    addRun(guild, 'Moon Brook', 200_000)
    addRun(guild, 'Moon Brook', 300_000, { status: 'cancelled' })
    addRun(unique('other-guild'), 'Moon Brook', 50_000)

    const active = core.startRun(guild, activeChannel, 'Moon Brook')

    const result = core.clearHistory(guild, 'moon brook')

    assert.deepEqual(result, { deleted: 3, active: 1 })
    assert.equal(core.getActiveRun(activeChannel)?.id, active.id)
    assert.equal(core.getPersonalBest(guild, 'Moon Brook'), null)

    const afterActiveFinishes = core.finishRun(activeChannel)
    assert.equal(afterActiveFinishes?.status, 'finished')

    const second = core.clearHistory(guild, 'Moon Brook')
    assert.deepEqual(second, { deleted: 1, active: 0 })
    assert.deepEqual(core.clearHistory(guild, 'Moon Brook'), { deleted: 0, active: 0 })
})

test('buildRunEmbed renders a running timer with party columns and no card by default', () => {
    const members = [
        { userId: '1', username: 'kev', role: 'Tank', sprite: 'female_tauren', wowName: 'Thrall' },
        { userId: '2', username: 'alice', role: 'Healer' },
        { userId: '3', username: 'bob', role: null },
        { userId: '4', username: 'carl', role: 'Tank' },
    ]

    const json = core
        .buildRunEmbed(makeRun({ dungeon: 'Local Only Dungeon' }), STARTED_AT + 65_000, {
            members,
            bestMs: 754_000,
        })
        .toJSON()

    assert.equal(json.title, '⏱️ Local Only Dungeon')
    assert.equal(json.description, '`00:01:05`')
    assert.equal(json.color, 0x5865f2)
    assert.equal(json.image, undefined)
    assert.match(json.footer.text, /^Started .+ • PB 00:12:34 • run #1$/)
    assert.ok(!JSON.stringify(json).includes('<t:'))

    const fields = json.fields ?? []
    assert.deepEqual(fields.map(field => field.name), [
        '🛡️ Tank',
        '⚔️ Melee',
        '🏹 Ranged',
        '➕ Healer',
        '❔ No role',
    ])
    assert.equal(fields[0]?.value, '<@4>\n<@1>')
    assert.equal(fields[1]?.value, '—')
    assert.equal(fields[2]?.value, '—')
    assert.equal(fields[3]?.value, '<@2>')
    assert.equal(fields[4]?.value, '<@3>')
    assert.ok(fields.every(field => field.inline === true))

    // sprite emoji moved to the card; role columns are plain mentions
    for (const field of fields) {
        assert.ok(!field.value.includes('🐮'))
        assert.ok(!field.value.includes('<:sp_'))
    }
})

test('buildRunEmbed uses artUrl when supplied and honours null', () => {
    const withArt = core
        .buildRunEmbed(makeRun(), STARTED_AT, { artUrl: 'attachment://run-card.png' })
        .toJSON()

    assert.equal(withArt.image?.url, 'attachment://run-card.png')

    const withoutArt = core
        .buildRunEmbed(makeRun(), STARTED_AT, { artUrl: null })
        .toJSON()

    assert.equal(withoutArt.image, undefined)
})

test('buildRunEmbed falls back to a remote registered background', () => {
    core.setDungeonBackground('Remote Dungeon', 'https://example.com/remote.png')

    const json = core
        .buildRunEmbed(makeRun({ dungeon: 'Remote Dungeon' }), STARTED_AT)
        .toJSON()

    assert.equal(json.image?.url, 'https://example.com/remote.png')
})

test('buildRunEmbed renders paused runs', () => {
    const run = makeRun({ status: 'paused', pausedAt: STARTED_AT + 60_000 })

    const json = core.buildRunEmbed(run, STARTED_AT + 65_000).toJSON()

    assert.equal(json.title, '⏸️ The Deadmines')
    assert.equal(json.description, 'Paused • `00:01:00`')
    assert.equal(json.color, 0xfaa61a)
    assert.match(json.footer.text, /⏸️ Paused/)
})

test('buildRunEmbed renders finished runs and personal best messaging', () => {
    const run = makeRun({
        status: 'finished',
        endedAt: STARTED_AT + 125_000,
        pausedTotal: 30_000,
    })

    const withBest = core
        .buildRunEmbed(run, STARTED_AT + 500_000, { bestMs: 754_000 })
        .toJSON()

    assert.equal(withBest.title, '🏁 The Deadmines')
    assert.equal(withBest.description, 'Finished in `00:01:35`')
    assert.equal(withBest.color, 0x57f287)
    assert.match(withBest.footer.text, /PB 00:12:34/)

    const newBest = core
        .buildRunEmbed(run, STARTED_AT + 500_000, { bestMs: 754_000, newPersonalBest: true })
        .toJSON()

    assert.equal(newBest.color, 0xfee75c)
    assert.match(newBest.footer.text, /🎉 New personal best! \(was 00:12:34\)/)

    const firstRun = core
        .buildRunEmbed(run, STARTED_AT + 500_000, { firstRun: true })
        .toJSON()

    assert.match(firstRun.footer.text, /📝 First recorded run/)
})

test('buildRunEmbed omits party fields when there are no members', () => {
    const json = core.buildRunEmbed(makeRun(), STARTED_AT).toJSON()

    assert.equal(json.fields, undefined)
})

test('buildRunEmbed truncates a role list under the field limit', () => {
    const members = Array.from({ length: 150 }, (_, index) => ({
        userId: String(1_000 + index),
        username: `user${String(index).padStart(3, '0')}`,
        role: 'Tank',
    }))

    const json = core.buildRunEmbed(makeRun(), STARTED_AT, { members }).toJSON()
    const tank = (json.fields ?? []).find(field => field.name === '🛡️ Tank')

    assert.ok(tank)
    assert.ok(tank.value.length <= 1024)
    assert.match(tank.value, /… \(\+\d+ more\)/)
    assert.ok(!tank.value.includes('<:sp_'))
})
