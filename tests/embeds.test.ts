import { test } from 'vitest'
import assert from 'node:assert/strict'
import { loadUtils } from './helpers.js'

const core = await loadUtils()

test('infoEmbed uses the info colour and optional title', () => {
    const plain = core.infoEmbed('Hello').toJSON()
    assert.equal(plain.color, 0x95a5a6)
    assert.equal(plain.description, 'Hello')
    assert.equal(plain.title, undefined)

    const titled = core.infoEmbed('Hello', 'Title').toJSON()
    assert.equal(titled.title, 'Title')
})

test('successEmbed uses the finished colour by default and accepts an override', () => {
    const defaultColor = core.successEmbed('Done', 'Title').toJSON()
    assert.equal(defaultColor.color, 0x57f287)
    assert.equal(defaultColor.description, 'Done')
    assert.equal(defaultColor.title, 'Title')

    const custom = core.successEmbed('Done', undefined, 0x123456).toJSON()
    assert.equal(custom.color, 0x123456)
    assert.equal(custom.title, undefined)
})

test('errorEmbed uses the error colour', () => {
    const json = core.errorEmbed('Nope', 'Error').toJSON()
    assert.equal(json.color, 0xed4245)
    assert.equal(json.description, 'Nope')
    assert.equal(json.title, 'Error')
})
