import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Collection } from 'discord.js'
import { loadUtils } from './helpers.js'

const core = await loadUtils()

interface FakeMemberOptions {
    globalName?: string | null
    displayName?: string
    nickname?: string | null
}

function makeMember(id: string, username: string, options: FakeMemberOptions = {}) {
    return {
        id,
        user: {
            id,
            username,
            globalName: options.globalName ?? null,
        },
        displayName: options.displayName ?? username,
        nickname: options.nickname ?? null,
    }
}

function makeCollection(...members: ReturnType<typeof makeMember>[]) {
    const collection = new Collection<string, ReturnType<typeof makeMember>>()
    for (const member of members) collection.set(member.id, member)
    return collection
}

test('parseMemberTokens splits commas, whitespace, quotes, and mentions', () => {
    assert.deepEqual(
        core.parseMemberTokens('alice, bob   carol'),
        ['alice', 'bob', 'carol'],
    )
    assert.deepEqual(
        core.parseMemberTokens('"Alice Smith", bob'),
        ['Alice Smith', 'bob'],
    )
    assert.deepEqual(
        core.parseMemberTokens('<@123> <@!456> alice'),
        ['<@123>', '<@!456>', 'alice'],
    )
    assert.deepEqual(
        core.parseMemberTokens('alice, alice <@789> <@789>'),
        ['alice', '<@789>'],
    )
    assert.deepEqual(core.parseMemberTokens(''), [])
    assert.deepEqual(core.parseMemberTokens('   ,  '), [])
})

test('resolveMemberTokens matches mentions, usernames, and names', () => {
    const alice = makeMember('1', 'alice', { globalName: 'Alice Global' })
    const bob = makeMember('2', 'bob', { displayName: 'Bobby', nickname: 'Bobbo' })
    const collection = makeCollection(alice, bob)

    assert.deepEqual(
        core.resolveMemberTokens(collection, ['<@1>']).members.map(member => member.id),
        ['1'],
    )
    assert.deepEqual(
        core.resolveMemberTokens(collection, ['<@!2>']).members.map(member => member.id),
        ['2'],
    )
    assert.deepEqual(
        core.resolveMemberTokens(collection, ['ALICE']).members.map(member => member.id),
        ['1'],
    )
    assert.deepEqual(
        core.resolveMemberTokens(collection, ['Alice Global']).members.map(member => member.id),
        ['1'],
    )
    assert.deepEqual(
        core.resolveMemberTokens(collection, ['Bobby']).members.map(member => member.id),
        ['2'],
    )
    assert.deepEqual(
        core.resolveMemberTokens(collection, ['Bobbo']).members.map(member => member.id),
        ['2'],
    )
})

test('resolveMemberTokens reports unknown and ambiguous tokens', () => {
    const bobOne = makeMember('1', 'bob-one', { displayName: 'Bob' })
    const bobTwo = makeMember('2', 'bob-two', { displayName: 'Bob' })
    const collection = makeCollection(bobOne, bobTwo)

    const result = core.resolveMemberTokens(collection, ['bob', 'ghost'])

    assert.deepEqual(result.members, [])
    assert.deepEqual(result.ambiguous, ['bob'])
    assert.deepEqual(result.unknown, ['ghost'])
})

test('a username match wins over a display name match', () => {
    const handleMatch = makeMember('1', 'bob', { displayName: 'Robert' })
    const displayMatch = makeMember('2', 'robert', { displayName: 'Bob' })
    const collection = makeCollection(handleMatch, displayMatch)

    const result = core.resolveMemberTokens(collection, ['bob'])

    assert.deepEqual(result.members.map(member => member.id), ['1'])
    assert.deepEqual(result.ambiguous, [])
    assert.deepEqual(result.unknown, [])
})

test('a unique global name disambiguates display name collisions', () => {
    const withGlobal = makeMember('1', 'bob-one', { displayName: 'Bob', globalName: 'bob' })
    const withoutGlobal = makeMember('2', 'bob-two', { displayName: 'Bob' })
    const collection = makeCollection(withGlobal, withoutGlobal)

    const result = core.resolveMemberTokens(collection, ['bob'])

    assert.deepEqual(result.members.map(member => member.id), ['1'])
    assert.deepEqual(result.ambiguous, [])
})

test('resolveMemberTokens de-duplicates the same member', () => {
    const alice = makeMember('1', 'alice')
    const collection = makeCollection(alice)

    const result = core.resolveMemberTokens(collection, ['<@1>', 'alice', 'ALICE'])

    assert.deepEqual(result.members.map(member => member.id), ['1'])
})
