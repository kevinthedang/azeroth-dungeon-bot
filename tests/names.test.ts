import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { cleanup, loadCore } from './helpers.js'

const core = await loadCore()

afterAll(cleanup)

test('normalizeWowName accepts normal character names', () => {
    assert.equal(core.normalizeWowName('Thrall'), 'Thrall')
    assert.equal(core.normalizeWowName('  Jaina  '), 'Jaina')
    assert.equal(core.normalizeWowName("Zul'jin"), "Zul'jin")
    assert.equal(core.normalizeWowName('Half-Elf'), 'Half-Elf')
    assert.equal(core.normalizeWowName('Ávö'), 'Ávö')
    assert.equal(core.normalizeWowName('Jo'), 'Jo')
    assert.equal(core.normalizeWowName('Abcdefghijkl'), 'Abcdefghijkl')
})

test('normalizeWowName rejects names outside the rules', () => {
    assert.equal(core.normalizeWowName(''), null)
    assert.equal(core.normalizeWowName('   '), null)
    assert.equal(core.normalizeWowName('J'), null)
    assert.equal(core.normalizeWowName('Thirteenchars'), null)
    assert.equal(core.normalizeWowName('123'), null)
    assert.equal(core.normalizeWowName('Thr all'), null)
    assert.equal(core.normalizeWowName('-Thrall'), null)
    assert.equal(core.normalizeWowName('Thrall123'), null)
})

test('setPlayerName stores, replaces, and isolates names per guild', () => {
    core.setPlayerName('guild-a', 'user-1', 'Thrall')
    assert.equal(core.getPlayerName('guild-a', 'user-1'), 'Thrall')

    core.setPlayerName('guild-a', 'user-1', 'Jaina')
    assert.equal(core.getPlayerName('guild-a', 'user-1'), 'Jaina')

    assert.equal(core.getPlayerName('guild-b', 'user-1'), null)
    assert.equal(core.getPlayerName('guild-a', 'user-2'), null)
})

test('clearPlayerName reports whether a name was removed', () => {
    core.setPlayerName('guild-clear', 'user-1', 'Thrall')

    assert.equal(core.clearPlayerName('guild-clear', 'user-1'), true)
    assert.equal(core.getPlayerName('guild-clear', 'user-1'), null)
    assert.equal(core.clearPlayerName('guild-clear', 'user-1'), false)
})
