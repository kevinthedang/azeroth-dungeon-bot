import { EmbedBuilder } from 'discord.js'
import type { SQLOutputValue } from 'node:sqlite'
import { db } from './db.js'
import { EmbedColor } from './utils/embeds.js'

export type RunStatus = 'running' | 'finished' | 'cancelled'

export interface DungeonRun {
    id: number
    guildId: string
    channelId: string
    dungeon: string
    /** epoch milliseconds — the single source of truth for the stopwatch */
    startedAt: number
    endedAt: number | null
    status: RunStatus
    messageId: string | null
}

const insertRunStmt = db.prepare(`
    INSERT INTO runs (guild_id, channel_id, dungeon, started_at)
    VALUES (?, ?, ?, ?)
`)

const selectActiveStmt = db.prepare(`
    SELECT * FROM runs
    WHERE channel_id = ? AND status = 'running'
    LIMIT 1
`)

const selectAllActiveStmt = db.prepare(`
    SELECT * FROM runs
    WHERE status = 'running'
    ORDER BY started_at
`)

const attachMessageStmt = db.prepare(`
    UPDATE runs SET message_id = ? WHERE id = ?
`)

const finishRunStmt = db.prepare(`
    UPDATE runs SET ended_at = ?, status = 'finished'
    WHERE id = ? AND status = 'running'
`)

const personalBestStmt = db.prepare(`
    SELECT MIN(ended_at - started_at) AS best
    FROM runs
    WHERE guild_id = ?
      AND dungeon COLLATE NOCASE = ?
      AND status = 'finished'
      AND ended_at IS NOT NULL
      AND id != ?
`)

const countActiveByDungeonStmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM runs
    WHERE guild_id = ? AND dungeon COLLATE NOCASE = ? AND status = 'running'
`)

const deleteHistoryStmt = db.prepare(`
    DELETE FROM runs
    WHERE guild_id = ?
      AND dungeon COLLATE NOCASE = ?
      AND status IN ('finished', 'cancelled')
`)

/** Translate a raw SQLite row into a typed run. */
function toRun(row: Record<string, SQLOutputValue>): DungeonRun {
    return {
        id: Number(row.id),
        guildId: String(row.guild_id),
        channelId: String(row.channel_id),
        dungeon: String(row.dungeon),
        startedAt: Number(row.started_at),
        endedAt: row.ended_at === null || row.ended_at === undefined ? null : Number(row.ended_at),
        status: String(row.status) as RunStatus,
        messageId: row.message_id === null || row.message_id === undefined ? null : String(row.message_id),
    }
}

/**
 * Create a new running dungeon run. Callers should check {@link getActiveRun}
 * first so a channel only ever has one live timer.
 */
export function startRun(guildId: string, channelId: string, dungeon: string): DungeonRun {
    const startedAt = Date.now()
    const { lastInsertRowid } = insertRunStmt.run(guildId, channelId, dungeon, startedAt)

    return {
        id: Number(lastInsertRowid),
        guildId,
        channelId,
        dungeon,
        startedAt,
        endedAt: null,
        status: 'running',
        messageId: null,
    }
}

export function getActiveRun(channelId: string): DungeonRun | undefined {
    const row = selectActiveStmt.get(channelId)
    return row ? toRun(row) : undefined
}

export function getActiveRuns(): DungeonRun[] {
    return selectAllActiveStmt.all().map(toRun)
}

/** Remember which Discord message renders this run's live timer. */
export function attachMessage(runId: number, messageId: string): void {
    attachMessageStmt.run(messageId, runId)
}

/**
 * Finish the active run in a channel. Returns the finished run, or `null` when
 * there was nothing to stop.
 */
export function finishRun(channelId: string): DungeonRun | null {
    const run = getActiveRun(channelId)
    if (!run) return null

    const endedAt = Date.now()
    finishRunStmt.run(endedAt, run.id)

    return { ...run, endedAt, status: 'finished' }
}

/** Format a duration as `HH:MM:SS`. */
export function formatElapsed(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':')
}

// Pacific time (PST/PDT, DST-aware). Change the timeZone here to display
// another region instead.
const PACIFIC_TIME = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
})

/** Format an epoch timestamp as Pacific time, e.g. `1:42 PM PST`. */
export function formatPacificTime(epochMs: number): string {
    return PACIFIC_TIME.format(new Date(epochMs))
}

/**
 * Fastest completed run of a dungeon anywhere in the guild, in milliseconds.
 * Excludes `excludeRunId` so a just-finished run can compare against the
 * previous record. Returns `null` when the dungeon has no completed runs.
 */
export function getPersonalBest(
    guildId: string,
    dungeon: string,
    excludeRunId: number = -1,
): number | null {
    const row = personalBestStmt.get(guildId, dungeon, excludeRunId)
    const best = row?.best

    return best === null || best === undefined ? null : Number(best)
}

export interface ClearHistoryResult {
    /** Number of completed/cancelled runs removed. */
    deleted: number
    /** Runs still in progress that were deliberately left alone. */
    active: number
}

/**
 * Delete the recorded history of a dungeon for a guild. Active runs are kept so
 * their live timers keep working; only finished/cancelled runs are removed.
 */
export function clearHistory(guildId: string, dungeon: string): ClearHistoryResult {
    const activeRow = countActiveByDungeonStmt.get(guildId, dungeon)
    const active = Number(activeRow?.count ?? 0)
    const { changes } = deleteHistoryStmt.run(guildId, dungeon)

    return { deleted: Number(changes), active }
}

export interface RenderRunOptions {
    /** Record to beat, shown while running and compared against when finished. */
    bestMs?: number | null
    /** This finished run beat the previous record. */
    newPersonalBest?: boolean
    /** This was the first completed run for the dungeon. */
    firstRun?: boolean
}

/** Build the embed that renders a run's timer. */
export function buildRunEmbed(
    run: DungeonRun,
    now: number = Date.now(),
    options: RenderRunOptions = {},
): EmbedBuilder {
    const elapsed = formatElapsed((run.endedAt ?? now) - run.startedAt)
    const best = options.bestMs != null ? formatElapsed(options.bestMs) : null
    const footer = [`run #${run.id}`]

    if (run.status === 'finished') {
        let color: number = EmbedColor.finished

        if (options.newPersonalBest && best) {
            footer.push(`🎉 New personal best! (was ${best})`)
            color = EmbedColor.personalBest
        } else if (options.firstRun) {
            footer.push('📝 First recorded run')
        } else if (best) {
            footer.push(`PB ${best}`)
        }

        return new EmbedBuilder()
            .setColor(color)
            .setTitle(`🏁 ${run.dungeon}`)
            .setDescription(`Finished in \`${elapsed}\``)
            .addFields({
                name: 'Started',
                value: formatPacificTime(run.startedAt),
                inline: true,
            })
            .setFooter({ text: footer.join(' • ') })
    }

    if (best) footer.push(`PB ${best}`)

    return new EmbedBuilder()
        .setColor(EmbedColor.running)
        .setTitle(`⏱️ ${run.dungeon}`)
        .setDescription(`\`${elapsed}\``)
        .addFields({
            name: 'Started',
            value: formatPacificTime(run.startedAt),
            inline: true,
        })
        .setFooter({ text: footer.join(' • ') })
}
