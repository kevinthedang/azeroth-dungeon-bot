import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { cleanup, loadCore } from './helpers.js'

const core = await loadCore()

afterAll(cleanup)

test('exposes the four WoW roles in order', () => {
    assert.deepEqual(core.WOW_ROLES, ['Tank', 'Melee', 'Ranged', 'Healer'])
})

test('isWowRole only accepts catalog roles', () => {
    for (const role of core.WOW_ROLES) assert.equal(core.isWowRole(role), true)

    assert.equal(core.isWowRole('tank'), false)
    assert.equal(core.isWowRole('Wizard'), false)
    assert.equal(core.isWowRole(''), false)
})

test('setPlayerRole stores, replaces, and isolates roles per guild', () => {
    core.setPlayerRole('guild-a', 'user-1', 'Tank')
    assert.equal(core.getPlayerRole('guild-a', 'user-1'), 'Tank')

    core.setPlayerRole('guild-a', 'user-1', 'Healer')
    assert.equal(core.getPlayerRole('guild-a', 'user-1'), 'Healer')

    assert.equal(core.getPlayerRole('guild-b', 'user-1'), null)
    assert.equal(core.getPlayerRole('guild-a', 'user-2'), null)
})
