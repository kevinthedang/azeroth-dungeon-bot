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
const DEFAULT_BACKGROUND = 'default'

/** Asset root, resolved per call so tests can point at a temporary directory. */
export function assetsDir(): string {
    return process.env.AZEROTH_ASSETS_DIR || resolve(process.cwd(), 'assets')
}

function backgroundDir(): string {
    return resolve(assetsDir(), 'backgrounds')
}

const DUNGEON_BACKGROUNDS: Record<string, string> = {
    // The Deadmines — uploaded as the `sp_art_the_deadmines` emoji
    the_deadmines: 'https://cdn.discordapp.com/emojis/1567581384149573774.png',
}

/** Dungeons currently supported by the /start dropdown. */
export const DUNGEONS = [
    'Ragefire Chasm',
    'The Hall of Thanes',
    'Wailing Caverns',
    'Ruins of Lordaeron',
    'The Deadmines',
    'Shadowfang Keep',
    'Blackfathom Deeps',
    'Stormwind Stockade',
    'Excavation Site: Wetlands',
    'City of Dalaran',
    'Gnomeregan',
    'Razorfen Kraul',
    'Scarlet Monastery - Graveyard',
    'Scarlet Monastery - Library',
    'The Drowned City',
    'Scarlet Monastery - Armory',
    'Razorfen Downs',
    'Scarlet Monastery - Cathedral',
    "Krol'dok Stronghold",
    'Uldaman',
    "Zul'Farrak",
    'Maraudon',
    'Alcaz Prison',
    'Sunken Temple',
    'Blackrock Depths',
    'Dire Maul (East)',
    'Lower Blackrock Spire',
    'Blackmaw Hold',
    'Dire Maul (West)',
    'Dire Maul (North)',
    'Scholomance',
    'Stratholme (Main Gate)',
    'Stratholme (Service Gate)',
    "Shaper's Terrace",
    'Upper Blackrock Spire',
    'Demon Fall Canyon',
    'Karazhan Crypts',
] as const

export const DUNGEON_LEVEL_RANGES: Partial<Record<(typeof DUNGEONS)[number], string>> = {
    'Ragefire Chasm': '13–18',
    'The Hall of Thanes': '13–20',
    'Wailing Caverns': '15–24',
    'Ruins of Lordaeron': '15–22',
    'The Deadmines': '17–26',
    'Shadowfang Keep': '20–30',
    'Blackfathom Deeps': '24–32',
    'Stormwind Stockade': '24–32',
    'Excavation Site: Wetlands': '26–33',
    'City of Dalaran': '28–35',
    'Gnomeregan': '29–38',
    'Razorfen Kraul': '29–38',
    'Scarlet Monastery - Graveyard': '30–38',
    'Scarlet Monastery - Library': '33–41',
    'The Drowned City': '35–40',
    'Scarlet Monastery - Armory': '36–44',
    'Razorfen Downs': '37–46',
    'Scarlet Monastery - Cathedral': '38–46',
    "Krol'dok Stronghold": '40–45',
    'Uldaman': '41–51',
    "Zul'Farrak": '44–54',
    'Maraudon': '46–55',
    'Alcaz Prison': '48–53',
    'Sunken Temple': '50–60',
    'Blackrock Depths': '52–60',
    'Dire Maul (East)': '54–60',
    'Lower Blackrock Spire': '55–60',
    'Blackmaw Hold': '55–60',
    'Dire Maul (West)': '56–60',
    'Dire Maul (North)': '56–60',
    'Scholomance': '58–60',
    'Stratholme (Main Gate)': '58–60',
    'Stratholme (Service Gate)': '58–60',
    "Shaper's Terrace": '58–60',
    'Upper Blackrock Spire': '59–60',
    'Demon Fall Canyon': '60–60',
    'Karazhan Crypts': '60–60',
}

export function formatDungeonChoice(dungeon: (typeof DUNGEONS)[number]): string {
    const levelRange = DUNGEON_LEVEL_RANGES[dungeon]
    return levelRange ? `${dungeon} — Levels ${levelRange}` : dungeon
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

    const file = resolve(backgroundDir(), `${slug}.png`)
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

    if (slug.startsWith('scarlet_monastery')) {
        const shared = localBackground('scarlet_monastery')
        if (shared) return shared
    }

    if (slug.startsWith('dire_maul')) {
        const shared = localBackground('dire_maul')
        if (shared) return shared
    }

    if (slug.endsWith('blackrock_spire')) {
        const shared = localBackground('blackrock_spire')
        if (shared) return shared
    }

    if (slug.startsWith('stratholme')) {
        const shared = localBackground('stratholme')
        if (shared) return shared
    }

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
