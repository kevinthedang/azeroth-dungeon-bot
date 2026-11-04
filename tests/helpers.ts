import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'

/**
 * Every test file runs in its own Node process, so each one gets a private
 * in-memory database and a throwaway asset tree. Set the env vars before any
 * `src/` module is imported — `src/core/db.ts` reads the path at load time.
 */
export const testRoot = mkdtempSync(join(tmpdir(), 'azeroth-chronicle-test-'))
export const testAssets = join(testRoot, 'assets')
export const backgroundsDir = join(testAssets, 'backgrounds')
export const spritesDir = join(testAssets, 'sprites')

process.env.AZEROTH_DB_PATH = ':memory:'
process.env.AZEROTH_ASSETS_DIR = testAssets

mkdirSync(backgroundsDir, { recursive: true })
mkdirSync(spritesDir, { recursive: true })

/** Write a tiny solid-colour PNG so canvas has something real to load. */
export function writePng(file: string, width = 64, height = 64, color = '#334455'): void {
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)
    writeFileSync(file, canvas.toBuffer('image/png'))
}

// a shared default so runs keep their card unless a test opts out
writePng(join(backgroundsDir, 'default.png'), 64, 64, '#223344')

export function cleanup(): void {
    rmSync(testRoot, { recursive: true, force: true })
}

export async function loadCore() {
    return import('../src/core/index.js')
}

export async function loadServices() {
    return import('../src/services/index.js')
}

export async function loadUtils() {
    return import('../src/utils/index.js')
}

const commandLoaders = {
    clear: () => import('../src/commands/clear.js'),
    clearName: () => import('../src/commands/clearName.js'),
    clearSprite: () => import('../src/commands/clearSprite.js'),
    drop: () => import('../src/commands/drop.js'),
    extraNote: () => import('../src/commands/extraNote.js'),
    setRole: () => import('../src/commands/setRole.js'),
    setName: () => import('../src/commands/setName.js'),
    setSprite: () => import('../src/commands/setSprite.js'),
    start: () => import('../src/commands/start.js'),
    stop: () => import('../src/commands/stop.js'),
} as const

export async function loadCommand(name: keyof typeof commandLoaders) {
    // static import map: Vite cannot resolve a dynamic template import
    return commandLoaders[name]()
}
