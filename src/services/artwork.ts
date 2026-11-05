import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { assetsDir, getDungeonBackground, getSpriteUrl, isSpriteKey } from '../core/index.js'
import type { RunMember } from '../core/index.js'

const PADDING = 64
const SPRITE_SIZE = 192
const NAME_FONT_SIZE = 48
const LINE_GAP = 32
const MEMBER_GAP = 16
const CARD_WIDTH = 1600
const CARD_HEIGHT = 672

const NAME_MIN_FONT_SIZE = 20

const MAX_CACHED_ART = 32
export const MAX_PARTY_MEMBERS = 10

/** File name used when the run card is attached to a message. */
export const ART_FILENAME = 'run-card.png'

interface TextMeasurer {
    font: string
    measureText(text: string): { width: number }
}

/**
 * Size a name so it fits its column: shrink the font first, then fall back to
 * an ellipsis once the name is too long to be legible at the minimum size.
 * Returns the text that should actually be drawn.
 */
function fitName(ctx: TextMeasurer, name: string, maxWidth: number): string {
    ctx.font = `${NAME_FONT_SIZE}px sans-serif`
    if (ctx.measureText(name).width <= maxWidth) return name

    const scaled = Math.max(
        NAME_MIN_FONT_SIZE,
        Math.floor((NAME_FONT_SIZE * maxWidth) / ctx.measureText(name).width),
    )
    ctx.font = `${scaled}px sans-serif`
    if (ctx.measureText(name).width <= maxWidth) return name

    // still too wide even at the minimum size, trim until "…" fits
    const ellipsis = '…'
    let low = 0
    let high = name.length

    while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        const candidate = name.slice(0, mid).trimEnd() + ellipsis
        if (ctx.measureText(candidate).width <= maxWidth) low = mid
        else high = mid - 1
    }

    return name.slice(0, low).trimEnd() + ellipsis
}

/**
 * Where to load a sprite from. Prefers the uploaded emoji, then the local file
 * the bot ships with, so a sprite still shows up if registration did not run.
 */
function spriteSource(key: string): string | undefined {
    if (!isSpriteKey(key)) return undefined

    const uploaded = getSpriteUrl(key)
    if (uploaded) return uploaded

    const local = resolve(assetsDir(), 'sprites', `${key}.png`)
    return existsSync(local) ? local : undefined
}

/** Members that have an available sprite, suitable for rendering on the card. */
export function getRenderableMembers(members: RunMember[]): Array<{ member: RunMember; source: string }> {
    return members
        .slice(0, MAX_PARTY_MEMBERS)
        .flatMap(member => {
            if (!member.sprite) return []
            const source = spriteSource(member.sprite)
            return source ? [{ member, source }] : []
        })
}

/**
 * Render a run card: dungeon background with each member's name above their
 * sprite, side by side from the bottom-left corner. Returns the composite as
 * a PNG buffer.
 */
export async function renderRunArt(backgroundUrl: string, members: RunMember[]): Promise<Buffer> {
    const visibleMembers = getRenderableMembers(members)
    const visibleCount = visibleMembers.length
    const background = await loadImage(backgroundUrl)
    const width = CARD_WIDTH
    const availableForSprites = width - PADDING * 2 - Math.max(0, visibleCount - 1) * MEMBER_GAP
    const spriteSize = Math.min(SPRITE_SIZE, Math.floor(availableForSprites / visibleCount))
    const nameBoxWidth = spriteSize - MEMBER_GAP

    const contentHeight = visibleCount > 0
        ? PADDING * 2 + NAME_FONT_SIZE + LINE_GAP + spriteSize
        : CARD_HEIGHT
    const height = Math.max(contentHeight, CARD_HEIGHT)

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    // Fill the standard card without stretching. This crops only excess edges.
    const scale = Math.max(width / background.width, height / background.height)
    const drawWidth = background.width * scale
    const drawHeight = background.height * scale
    const drawX = (width - drawWidth) / 2
    const drawY = (height - drawHeight) / 2
    ctx.drawImage(background, drawX, drawY, drawWidth, drawHeight)

    let x = PADDING
    for (const { member, source } of visibleMembers) {
        const spriteY = height - PADDING - spriteSize
        const nameY = spriteY - LINE_GAP - NAME_FONT_SIZE / 2

        const displayName = member.wowName?.trim() || member.username
        if (displayName) {
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#ffffff'
            const label = fitName(ctx, displayName, nameBoxWidth)
            ctx.fillText(label, x + spriteSize / 2, nameY)
        }

        if (source) {
            try {
                const sprite = await loadImage(source)
                ctx.drawImage(sprite, x, spriteY, spriteSize, spriteSize)
            } catch (error) {
                // a broken sprite should never take the whole card down
                console.error(`[Artwork] sprite ${member.sprite} failed:`, error)
            }
        }

        x += spriteSize + MEMBER_GAP
    }

    return canvas.toBuffer('image/png')
}

const artCache = new Map<string, Buffer>()

/**
 * Composite a run card for a dungeon, or `null` when the dungeon has no
 * background registered or rendering failed.
 *
 * The result is sent as a normal message attachment rather than an embed image:
 * Discord downscales emoji media and boxes embed images, while attachments keep
 * their full resolution and can be opened for the original size.
 */
export async function renderRunArtBuffer(dungeon: string, members: RunMember[]): Promise<Buffer | null> {
    const backgroundUrl = getDungeonBackground(dungeon)
    if (!backgroundUrl) return null

    const visibleMembers = getRenderableMembers(members)
    const key = `${backgroundUrl}|${dungeon}|${visibleMembers
        .map(({ member }) => `${member.userId}:${member.wowName ?? member.username}:${member.sprite ?? ''}`)
        .sort()
        .join(',')}`

    const cached = artCache.get(key)
    if (cached) return cached

    try {
        const buffer = await renderRunArt(backgroundUrl, members)

        if (artCache.size >= MAX_CACHED_ART) {
            const oldest = artCache.keys().next()
            if (!oldest.done) artCache.delete(oldest.value)
        }
        artCache.set(key, buffer)

        return buffer
    } catch (error) {
        // fall back to the plain embed so the run itself keeps working
        console.error(`[Artwork] run card for "${dungeon}" failed:`, error)
        return null
    }
}
