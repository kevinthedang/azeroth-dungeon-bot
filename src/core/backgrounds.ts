import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Dungeon background art, keyed by the slugified dungeon name. Lookups are
 * derived from the name entered at `/start`, e.g. "The Deadmines" → "the_deadmines".
 *
 * Art is resolved in this order:
 *   1. `assets/backgrounds/{slug}.png` (drop a file in, no upload needed)
 *   2. an entry registered with `setDungeonBackground` (hosted URL)
 *   3. `assets/backgrounds/default.png`
 */
const BACKGROUND_DIR = resolve(process.cwd(), 'assets', 'backgrounds')
const DEFAULT_BACKGROUND = 'default'

const DUNGEON_BACKGROUNDS: Record<string, string> = {
    // The Deadmines — uploaded as the `sp_art_the_deadmines` emoji
    the_deadmines: 'https://cdn.discordapp.com/emojis/1567581384149573774.png',
}

/** Lowercase the dungeon name and replace non-alphanumeric runs with `_`. */
export function slugifyDungeonName(dungeon: string): string {
    return dungeon
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

/** Absolute path to a background file in `assets/backgrounds`, if present. */
function localBackground(slug: string): string | undefined {
    if (!slug) return undefined

    const file = resolve(BACKGROUND_DIR, `${slug}.png`)
    return existsSync(file) ? file : undefined
}

/** True for `http(s)://` sources, the only kind an embed image accepts. */
export function isRemoteUrl(source: string): boolean {
    return /^https?:\/\//i.test(source)
}

/**
 * Background art for a dungeon: its own file, a registered URL, or the shared
 * default. Returns `undefined` only when no default exists either.
 */
export function getDungeonBackground(dungeon: string): string | undefined {
    const slug = slugifyDungeonName(dungeon)

    return localBackground(slug)
        ?? DUNGEON_BACKGROUNDS[slug]
        ?? localBackground(DEFAULT_BACKGROUND)
}

/** Register (or clear) a hosted background URL for a dungeon. */
export function setDungeonBackground(dungeon: string, url: string | null): void {
    const key = slugifyDungeonName(dungeon)

    if (url === null) {
        delete DUNGEON_BACKGROUNDS[key]
        return
    }

    DUNGEON_BACKGROUNDS[key] = url
}
