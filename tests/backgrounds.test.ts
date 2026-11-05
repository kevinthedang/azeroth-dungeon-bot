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
    assert.ok(core.DUNGEONS.includes('Hall of Thanes'))
    assert.ok(core.DUNGEONS.includes('Wailing Caverns'))
    assert.ok(core.DUNGEONS.includes('Ruins of Lordaeron'))
    assert.ok(core.DUNGEONS.includes('Shadowfang Keep'))
    assert.ok(core.DUNGEONS.includes('Blackfathom Deeps'))
    assert.ok(core.DUNGEONS.includes('The Stockade'))
    assert.ok(core.DUNGEONS.includes('Excavation Site: Wetlands'))
    assert.ok(core.DUNGEONS.includes('City of Dalaran'))
    assert.ok(core.DUNGEONS.includes('The Drowned City'))
    assert.ok(core.DUNGEONS.includes("Krol'dok Stronghold"))
    assert.ok(core.DUNGEONS.includes('Gnomeregan'))
    assert.ok(core.DUNGEONS.includes('Karazhan Crypts'))
    assert.equal(core.DUNGEONS.length, 38)
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

test('falls back to default.png when the dungeon has no art', () => {
    assert.equal(core.getDungeonBackground('Nowhere Special'), defaultBackground)
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
