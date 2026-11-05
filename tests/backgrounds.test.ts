import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
    backgroundsDir,
    cleanup,
    loadCore,
    testRoot,
    writePng,
} from './helpers.js'

const core = await loadCore()
const defaultBackground = join(backgroundsDir, 'default.png')

afterAll(cleanup)

test('slugifyDungeonName lowercases and normalizes punctuation', () => {
    assert.equal(core.slugifyDungeonName('The Deadmines'), 'the_deadmines')
    assert.equal(core.slugifyDungeonName('  Moon Brook!! '), 'moon_brook')
    assert.equal(core.slugifyDungeonName("Zul'Gurub"), 'zul_gurub')
    assert.equal(core.slugifyDungeonName('___'), '')
    assert.equal(core.slugifyDungeonName('123'), '123')
})

test('includes the expanded dungeon list without realm suffixes', () => {
    assert.ok(core.DUNGEONS.includes('Ragefire Chasm'))
    assert.ok(core.DUNGEONS.includes('The Hall of Thanes'))
    assert.ok(core.DUNGEONS.includes('Wailing Caverns'))
    assert.ok(core.DUNGEONS.includes('Ruins of Lordaeron'))
    assert.ok(core.DUNGEONS.includes('Shadowfang Keep'))
    assert.ok(core.DUNGEONS.includes('Blackfathom Deeps'))
    assert.ok(core.DUNGEONS.includes('Stormwind Stockade'))
    assert.ok(!core.DUNGEONS.includes('The Stockade'))
    assert.ok(core.DUNGEONS.includes('Excavation Site: Wetlands'))
    assert.ok(core.DUNGEONS.includes('City of Dalaran'))
    assert.ok(core.DUNGEONS.includes('The Drowned City'))
    assert.ok(core.DUNGEONS.includes("Krol'dok Stronghold"))
    assert.ok(core.DUNGEONS.includes('Gnomeregan'))
    assert.ok(core.DUNGEONS.includes('Karazhan Crypts'))
    assert.equal(core.DUNGEONS.length, 38)
})

test('includes and formats dungeon level ranges', () => {
    assert.equal(core.formatDungeonChoice('Ragefire Chasm'), 'Ragefire Chasm — Levels 13–18')
    assert.equal(core.formatDungeonChoice('The Deadmines'), 'The Deadmines — Levels 17–26')
    assert.equal(core.formatDungeonChoice('Moon Brook'), 'Moon Brook')
    assert.equal(core.DUNGEONS[0], 'Ragefire Chasm')
    assert.equal(core.DUNGEONS[core.DUNGEONS.length - 1], 'Moon Brook')
})

test('isRemoteUrl only accepts http(s) sources', () => {
    assert.equal(core.isRemoteUrl('https://example.com/bg.png'), true)
    assert.equal(core.isRemoteUrl('HTTP://example.com/bg.png'), true)
    assert.equal(core.isRemoteUrl('ftp://example.com/bg.png'), false)
    assert.equal(core.isRemoteUrl('/tmp/bg.png'), false)
    assert.equal(core.isRemoteUrl('bg.png'), false)
})

test('a local dungeon file wins over the registered URL', () => {
    writePng(join(backgroundsDir, 'the_deadmines.png'))

    assert.equal(
        core.getDungeonBackground('The Deadmines'),
        join(backgroundsDir, 'the_deadmines.png'),
    )
})

test('all Scarlet Monastery wings use the shared background image', () => {
    const sharedBackground = join(backgroundsDir, 'scarlet_monastery.png')
    writePng(sharedBackground)

    for (const dungeon of [
        'Scarlet Monastery - Graveyard',
        'Scarlet Monastery - Library',
        'Scarlet Monastery - Armory',
        'Scarlet Monastery - Cathedral',
    ]) {
        assert.equal(core.getDungeonBackground(dungeon), sharedBackground)
    }
})

test('all Dire Maul wings use the shared background image', () => {
    const sharedBackground = join(backgroundsDir, 'dire_maul.png')
    writePng(sharedBackground)

    for (const dungeon of [
        'Dire Maul (East)',
        'Dire Maul (West)',
        'Dire Maul (North)',
    ]) {
        assert.equal(core.getDungeonBackground(dungeon), sharedBackground)
    }
})

test('both Blackrock Spire wings use the shared background image', () => {
    const sharedBackground = join(backgroundsDir, 'blackrock_spire.png')
    writePng(sharedBackground)

    for (const dungeon of [
        'Lower Blackrock Spire',
        'Upper Blackrock Spire',
    ]) {
        assert.equal(core.getDungeonBackground(dungeon), sharedBackground)
    }
})

test('both Stratholme gates use the shared background image', () => {
    const sharedBackground = join(backgroundsDir, 'stratholme.png')
    writePng(sharedBackground)

    for (const dungeon of [
        'Stratholme (Main Gate)',
        'Stratholme (Service Gate)',
    ]) {
        assert.equal(core.getDungeonBackground(dungeon), sharedBackground)
    }
})

test('falls back to default.png when the dungeon has no art', () => {
    assert.equal(core.getDungeonBackground('Nowhere Special'), defaultBackground)
})

test('Zul Farrak resolves the renamed slug file', () => {
    const zulfarrakBackground = join(backgroundsDir, 'zul_farrak.png')
    writePng(zulfarrakBackground)

    assert.equal(core.getDungeonBackground("Zul'Farrak"), zulfarrakBackground)
})

test('a registered URL is used until it is cleared', () => {
    core.setDungeonBackground('Hosted Dungeon', 'https://example.com/bg.png')

    assert.equal(core.getDungeonBackground('Hosted Dungeon'), 'https://example.com/bg.png')

    core.setDungeonBackground('Hosted Dungeon', null)

    assert.equal(core.getDungeonBackground('Hosted Dungeon'), defaultBackground)
})

test('returns undefined when there is no local, registered, or default art', () => {
    const emptyAssets = join(testRoot, 'no-art-assets')
    mkdirSync(join(emptyAssets, 'backgrounds'), { recursive: true })

    const previous = process.env.AZEROTH_ASSETS_DIR
    process.env.AZEROTH_ASSETS_DIR = emptyAssets

    try {
        assert.equal(core.getDungeonBackground('Nothing Here'), undefined)

        core.setDungeonBackground('Empty Hosted', 'https://example.com/empty.png')
        assert.equal(core.getDungeonBackground('Empty Hosted'), 'https://example.com/empty.png')

        core.setDungeonBackground('Empty Hosted', null)
        assert.equal(core.getDungeonBackground('Empty Hosted'), undefined)
    } finally {
        if (previous === undefined) delete process.env.AZEROTH_ASSETS_DIR
        else process.env.AZEROTH_ASSETS_DIR = previous
    }
})
