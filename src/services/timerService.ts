import type { Client, Message } from 'discord.js'
import { buildRunEmbed, getActiveRun, getActiveRuns, getPersonalBest, type DungeonRun } from '../timers.js'

/** Discord allows roughly 5 edits per 5 seconds per channel, so 5s is safe. */
const UPDATE_INTERVAL_MS = 5_000

let interval: NodeJS.Timeout | null = null
let refreshing = false

// keep message objects around so we do not refetch them every tick
const messageCache = new Map<number, Message>()

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

        const message = await resolveMessage(client, run)
        if (!message) return

        const bestMs = getPersonalBest(current.guildId, current.dungeon, current.id)
        await message.edit({
            content: null,
            embeds: [buildRunEmbed(current, Date.now(), { bestMs })],
        })
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
