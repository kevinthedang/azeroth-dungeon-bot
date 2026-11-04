/**
 * Dungeon background art, keyed by the slugified dungeon name. Lookups are
 * derived from the name entered at `/start`, e.g. "The Deadmines" → "the_deadmines".
 *
 * Backgrounds are registered with a hosted image URL (Discord CDN or your own
 * host) and looked up by slug, so `/start` with dungeon "The Deadmines" resolves
 * to the art registered under `the_deadmines`.
 */
const DUNGEON_BACKGROUNDS: Record<string, string> = {
    // The Deadmines — test background (uploaded as the `sp_art_the_deadmines` emoji)
    the_deadmines: 'https://cdn.discordapp.com/emojis/1567581384149573774.png',
    // Moon Brook — uploaded via the run-card composite flow
    moon_brook: 'https://cdn.discordapp.com/emojis/1567596489868447927.png',
}

/** Lowercase the dungeon name and replace non-alphanumeric runs with `_`. */
export function slugifyDungeonName(dungeon: string): string {
    return dungeon
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

/** Background art URL for a dungeon, or `undefined` when none is registered. */
export function getDungeonBackground(dungeon: string): string | undefined {
    return DUNGEON_BACKGROUNDS[slugifyDungeonName(dungeon)]
}

/** Register (or clear) the background art for a dungeon. */
export function setDungeonBackground(dungeon: string, url: string | null): void {
    const key = slugifyDungeonName(dungeon)

    if (url === null) {
        delete DUNGEON_BACKGROUNDS[key]
        return
    }

    DUNGEON_BACKGROUNDS[key] = url
}
