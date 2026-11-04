import { AttachmentBuilder, type Client, type Message } from 'discord.js'
import { buildRunEmbed, getActiveRun, getActiveRuns, getPersonalBest, getRunMembers, getRunNotes, type DungeonRun } from '../core/index.js'
import { ART_FILENAME, renderRunArtBuffer } from './artwork.js'

/** Refresh cadence for the live timer message (well under Discord's edit limit). */
const UPDATE_INTERVAL_MS = 10_000

let interval: NodeJS.Timeout | null = null
let refreshing = false

// keep message objects around so we do not refetch them every tick
const messageCache = new Map<number, Message>()

// paused runs have static timers, so only render them once
const pausedRendered = new Set<number>()

/**
 * Start the background loop that keeps every active run's message in sync with
 * the clock. Safe to call more than once.
 */
export function startTimerService(client: Client): void {
    if (interval) return

    interval = setInterval(() => void refreshTimers(client), UPDATE_INTERVAL_MS)
    void refreshTimers(client)
}

export function stopTimerService(): void {
    if (!interval) return

    clearInterval(interval)
    interval = null
    messageCache.clear()
    pausedRendered.clear()
}

async function refreshTimers(client: Client): Promise<void> {
    // a slow tick should never overlap with the next one
    if (refreshing) return
    refreshing = true

    try {
        const runs = getActiveRuns()

        // drop cached messages for runs that are no longer active
        const activeIds = new Set(runs.map(run => run.id))
        for (const id of messageCache.keys()) {
            if (!activeIds.has(id)) messageCache.delete(id)
        }
        for (const id of pausedRendered) {
            if (!activeIds.has(id)) pausedRendered.delete(id)
        }

        for (const run of runs) {
            await refreshRun(client, run)
        }
    } catch (error) {
        console.error('[TimerService]', error)
    } finally {
        refreshing = false
    }
}

async function refreshRun(client: Client, run: DungeonRun): Promise<void> {
    if (!run.messageId) return

    try {
        // the run may have been stopped after this tick's snapshot was taken;
        // never let a stale tick overwrite the final message
        const current = getActiveRun(run.channelId)
        if (!current || current.id !== run.id) return

        const isPaused = current.status === 'paused'
        if (isPaused && pausedRendered.has(current.id)) return

        const message = await resolveMessage(client, run)
        if (!message) return

        const bestMs = getPersonalBest(current.guildId, current.dungeon, current.id)
        const members = getRunMembers(current.id)
        const notes = getRunNotes(current.id)

        // the card is attached once; later ticks only update the embed so we do
        // not re-upload the PNG every five seconds
        const existingArt = message.attachments.first()?.name
        const art = existingArt ? null : await renderRunArtBuffer(current.dungeon, members)
        const artUrl = existingArt
            ? `attachment://${existingArt}`
            : art
                ? `attachment://${ART_FILENAME}`
                : null

        const edited = await message.edit({
            content: null,
            embeds: [
                buildRunEmbed(current, Date.now(), {
                    bestMs,
                    members,
                    notes,
                    artUrl,
                }),
            ],
            ...(art ? { files: [new AttachmentBuilder(art, { name: ART_FILENAME })] } : {}),
            allowedMentions: { parse: [] },
        })

        messageCache.set(run.id, edited)

        if (isPaused) pausedRendered.add(current.id)
        else pausedRendered.delete(current.id)
    } catch (error) {
        // the message was probably deleted; let the next tick retry from scratch
        messageCache.delete(run.id)
        console.error(`[TimerService: run ${run.id}]`, error)
    }
}

async function resolveMessage(client: Client, run: DungeonRun): Promise<Message | null> {
    const cached = messageCache.get(run.id)
    if (cached) return cached
    if (!run.messageId) return null

    const channel = client.channels.cache.get(run.channelId)
        ?? await client.channels.fetch(run.channelId).catch(() => null)
    if (!channel || !channel.isTextBased()) return null

    const message = await channel.messages.fetch(run.messageId).catch(() => null)
    if (message) messageCache.set(run.id, message)

    return message
}
