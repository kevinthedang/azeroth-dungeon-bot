import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
    backgroundsDir,
    cleanup,
    loadCore,
    loadServices,
    spritesDir,
    testRoot,
    writePng,
} from './helpers.js'

const core = await loadCore()
const services = await loadServices()

afterAll(cleanup)

function pngSize(buffer: Buffer): { width: number; height: number } {
    assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function member(index: number, overrides: Record<string, unknown> = {}) {
    return {
        userId: String(index),
        username: `user${index}`,
        wowName: `Hero${index}`,
        sprite: 'female_tauren',
        role: 'Tank',
        ...overrides,
    }
}

test('renders a card for the dungeon background at the minimum width', async () => {
    writePng(join(backgroundsDir, 'test_dungeon.png'), 1200, 600)
    writePng(join(spritesDir, 'female_tauren.png'), 256, 256, '#aa3344')

    // no emoji registered in this process: the renderer must use the local file
    assert.equal(core.getSpriteUrl('female_tauren'), undefined)

    const buffer = await services.renderRunArtBuffer('Test Dungeon', [member(1)])
    assert.ok(buffer)

    assert.deepEqual(pngSize(buffer), { width: 1100, height: 464 })
})

test('widens the card for large parties', async () => {
    const members = Array.from({ length: 6 }, (_, index) => member(index + 10))

    const buffer = await services.renderRunArtBuffer('Test Dungeon', members)
    assert.ok(buffer)

    assert.deepEqual(pngSize(buffer), { width: 1664, height: 464 })
})

test('caches identical card renders', async () => {
    const members = [member(20)]

    const first = await services.renderRunArtBuffer('Test Dungeon', members)
    const second = await services.renderRunArtBuffer('Test Dungeon', members)

    assert.ok(first)
    assert.strictEqual(second, first)
})

test('uses default.png when the dungeon has no art of its own', async () => {
    const buffer = await services.renderRunArtBuffer('Fresh Dungeon', [member(30)])
    assert.ok(buffer)
    assert.deepEqual(pngSize(buffer), { width: 1100, height: 464 })
})

test('returns null when no background exists at all', async () => {
    const emptyAssets = join(testRoot, 'artwork-empty')
    mkdirSync(join(emptyAssets, 'backgrounds'), { recursive: true })
    mkdirSync(join(emptyAssets, 'sprites'), { recursive: true })

    const previous = process.env.AZEROTH_ASSETS_DIR
    process.env.AZEROTH_ASSETS_DIR = emptyAssets

    try {
        assert.equal(await services.renderRunArtBuffer('Missing Dungeon', []), null)
        assert.equal(core.getDungeonBackground('Missing Dungeon'), undefined)
    } finally {
        if (previous === undefined) delete process.env.AZEROTH_ASSETS_DIR
        else process.env.AZEROTH_ASSETS_DIR = previous
    }
})

test('returns null when the background cannot be decoded', async () => {
    writeFileSync(join(backgroundsDir, 'bad_background.png'), 'not a png')

    assert.equal(await services.renderRunArtBuffer('Bad Background', [member(40)]), null)
})

test('a broken sprite does not take the card down', async () => {
    const brokenAssets = join(testRoot, 'artwork-broken-sprite')
    mkdirSync(join(brokenAssets, 'backgrounds'), { recursive: true })
    mkdirSync(join(brokenAssets, 'sprites'), { recursive: true })
    writePng(join(brokenAssets, 'backgrounds', 'default.png'))
    writeFileSync(join(brokenAssets, 'sprites', 'female_tauren.png'), 'not a png')

    const previous = process.env.AZEROTH_ASSETS_DIR
    process.env.AZEROTH_ASSETS_DIR = brokenAssets

    try {
        const buffer = await services.renderRunArtBuffer('Broken Sprite', [member(50)])
        assert.ok(buffer)
        assert.deepEqual(pngSize(buffer), { width: 1100, height: 464 })
    } finally {
        if (previous === undefined) delete process.env.AZEROTH_ASSETS_DIR
        else process.env.AZEROTH_ASSETS_DIR = previous
    }
})

test('unknown sprite keys are skipped without failing the card', async () => {
    const buffer = await services.renderRunArtBuffer('Test Dungeon', [
        member(60, { sprite: 'male_orc' }),
        member(61, { sprite: null }),
        member(62, { wowName: null, username: 'FallbackName' }),
    ])

    assert.ok(buffer)
    assert.deepEqual(pngSize(buffer), { width: 1100, height: 464 })
})

test('exposes the attachment filename used by the embed', () => {
    assert.equal(services.ART_FILENAME, 'run-card.png')
})
