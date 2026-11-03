import { EmbedBuilder } from 'discord.js'
import type { SQLOutputValue } from 'node:sqlite'
import { db } from './db.js'
import { isWowRole, WOW_ROLES, type WowRole } from './roles.js'
import { EmbedColor } from '../utils/index.js'

export type RunStatus = 'running' | 'paused' | 'finished' | 'cancelled'

export interface RunMember {
    userId: string
    username: string
    /** Current WoW role, resolved from player_roles when the run is loaded. */
    role?: WowRole | null
}

export interface DungeonRun {
    id: number
    guildId: string
    channelId: string
    dungeon: string
    /** epoch milliseconds — the single source of truth for the stopwatch */
    startedAt: number
    endedAt: number | null
    /** Total time already spent paused, in milliseconds. */
    pausedTotal: number
    /** When the current pause began, or `null` while running. */
    pausedAt: number | null
    status: RunStatus
    messageId: string | null
}

const insertRunStmt = db.prepare(`
    INSERT INTO runs (guild_id, channel_id, dungeon, started_at)
    VALUES (?, ?, ?, ?)
`)

const insertMemberStmt = db.prepare(`
    INSERT OR IGNORE INTO run_members (run_id, user_id, username)
    VALUES (?, ?, ?)
`)

const selectMembersStmt = db.prepare(`
    SELECT rm.user_id, rm.username, pr.role
    FROM run_members rm
    JOIN runs r ON r.id = rm.run_id
    LEFT JOIN player_roles pr
        ON pr.guild_id = r.guild_id AND pr.user_id = rm.user_id
    WHERE rm.run_id = ?
    ORDER BY rm.rowid
`)

const selectActiveStmt = db.prepare(`
    SELECT * FROM runs
    WHERE channel_id = ? AND status IN ('running', 'paused')
    LIMIT 1
`)

const selectAllActiveStmt = db.prepare(`
    SELECT * FROM runs
    WHERE status IN ('running', 'paused')
    ORDER BY started_at
`)

const attachMessageStmt = db.prepare(`
    UPDATE runs SET message_id = ? WHERE id = ?
`)

const finishRunStmt = db.prepare(`
    UPDATE runs
    SET ended_at = ?, paused_total = ?, paused_at = NULL, status = 'finished'
    WHERE id = ? AND status IN ('running', 'paused')
`)

const pauseRunStmt = db.prepare(`
    UPDATE runs SET status = 'paused', paused_at = ?
    WHERE id = ? AND status = 'running'
`)

const resumeRunStmt = db.prepare(`
    UPDATE runs SET status = 'running', paused_at = NULL, paused_total = ?
    WHERE id = ? AND status = 'paused'
`)

const personalBestStmt = db.prepare(`
    SELECT MIN(ended_at - started_at - paused_total) AS best
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
    WHERE guild_id = ? AND dungeon COLLATE NOCASE = ? AND status IN ('running', 'paused')
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
        pausedTotal: row.paused_total === null || row.paused_total === undefined ? 0 : Number(row.paused_total),
        pausedAt: row.paused_at === null || row.paused_at === undefined ? null : Number(row.paused_at),
        status: String(row.status) as RunStatus,
        messageId: row.message_id === null || row.message_id === undefined ? null : String(row.message_id),
    }
}

/**
 * Create a new running dungeon run with its party. Callers should check
 * {@link getActiveRun} first so a channel only ever has one live timer.
 */
export function startRun(
    guildId: string,
    channelId: string,
    dungeon: string,
    members: RunMember[] = [],
): DungeonRun {
    const startedAt = Date.now()

    // insert the run and its party atomically
    db.exec('BEGIN')
    try {
        const { lastInsertRowid } = insertRunStmt.run(guildId, channelId, dungeon, startedAt)
        const id = Number(lastInsertRowid)

        for (const member of members) {
            insertMemberStmt.run(id, member.userId, member.username)
        }

        db.exec('COMMIT')

        return {
            id,
            guildId,
            channelId,
            dungeon,
            startedAt,
            endedAt: null,
            pausedTotal: 0,
            pausedAt: null,
            status: 'running',
            messageId: null,
        }
    } catch (error) {
        db.exec('ROLLBACK')
        throw error
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

/** Load the party recorded for a run, in the order they were added. */
export function getRunMembers(runId: number): RunMember[] {
    return selectMembersStmt.all(runId).map(row => {
        const rawRole = row.role
        const role = rawRole === null || rawRole === undefined ? null : String(rawRole)

        return {
            userId: String(row.user_id),
            username: String(row.username),
            role: role !== null && isWowRole(role) ? role : null,
        }
    })
}

/**
 * Finish the active run in a channel. Returns the finished run, or `null` when
 * there was nothing to stop.
 */
export function finishRun(channelId: string): DungeonRun | null {
    const run = getActiveRun(channelId)
    if (!run) return null

    const endedAt = Date.now()
    const pausedTotal = run.pausedTotal + (run.pausedAt !== null ? endedAt - run.pausedAt : 0)
    finishRunStmt.run(endedAt, pausedTotal, run.id)

    return { ...run, endedAt, pausedTotal, pausedAt: null, status: 'finished' }
}

/** Pause a running run. Returns `null` when there is nothing running to pause. */
export function pauseRun(channelId: string): DungeonRun | null {
    const run = getActiveRun(channelId)
    if (!run || run.status !== 'running') return null

    const pausedAt = Date.now()
    pauseRunStmt.run(pausedAt, run.id)

    return { ...run, status: 'paused', pausedAt }
}

/** Resume a paused run. Returns `null` when the run is not paused. */
export function resumeRun(channelId: string): DungeonRun | null {
    const run = getActiveRun(channelId)
    if (!run || run.status !== 'paused' || run.pausedAt === null) return null

    const resumedAt = Date.now()
    const pausedTotal = run.pausedTotal + (resumedAt - run.pausedAt)
    resumeRunStmt.run(pausedTotal, run.id)

    return { ...run, status: 'running', pausedAt: null, pausedTotal }
}

/** Elapsed time in milliseconds, excluding all paused time. */
export function getElapsedMs(run: DungeonRun, now: number = Date.now()): number {
    const end = run.endedAt ?? now
    const currentPause = run.pausedAt !== null ? end - run.pausedAt : 0

    return Math.max(0, end - run.startedAt - run.pausedTotal - currentPause)
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
    bestMs?: number | null | undefined
    /** This finished run beat the previous record. */
    newPersonalBest?: boolean | undefined
    /** This was the first completed run for the dungeon. */
    firstRun?: boolean | undefined
    /** Party members to list under the timer. */
    members?: RunMember[] | undefined
}

const ROLE_ICONS: Record<WowRole, string> = {
    Tank: '🛡️',
    Melee: '⚔️',
    Ranged: '🏹',
    Healer: '➕',
}

/** Join mentions with newlines, staying under Discord's 1024-char field limit. */
function formatRoleList(members: RunMember[]): string {
    const sorted = [...members].sort((a, b) => a.username.localeCompare(b.username))

    let value = ''
    let shown = 0

    for (const member of sorted) {
        const entry = `${shown === 0 ? '' : '\n'}<@${member.userId}>`
        const remainingAfter = sorted.length - shown - 1
        const suffix = remainingAfter > 0 ? `\n… (+${remainingAfter} more)` : ''

        if (value.length + entry.length + suffix.length > 1024) break

        value += entry
        shown++
    }

    const remaining = sorted.length - shown
    if (remaining > 0) value += `\n… (+${remaining} more)`

    return value
}

/** Add one inline column per role, plus an unassigned column when needed. */
function addPartyFields(embed: EmbedBuilder, members: RunMember[]): void {
    const byRole = new Map<WowRole, RunMember[]>()
    const unassigned: RunMember[] = []

    for (const member of members) {
        if (!member.role) {
            unassigned.push(member)
            continue
        }

        const list = byRole.get(member.role) ?? []
        list.push(member)
        byRole.set(member.role, list)
    }

    for (const role of WOW_ROLES) {
        const list = byRole.get(role) ?? []

        embed.addFields({
            name: `${ROLE_ICONS[role]} ${role}`,
            value: list.length > 0 ? formatRoleList(list) : '—',
            inline: true,
        })
    }

    if (unassigned.length > 0) {
        embed.addFields({
            name: '❔ No role',
            value: formatRoleList(unassigned),
            inline: true,
        })
    }
}

/** Build the embed that renders a run's timer. */
export function buildRunEmbed(
    run: DungeonRun,
    now: number = Date.now(),
    options: RenderRunOptions = {},
): EmbedBuilder {
    const elapsed = formatElapsed(getElapsedMs(run, now))
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

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🏁 ${run.dungeon}`)
            .setDescription(`Finished in \`${elapsed}\``)

        if (options.members?.length) addPartyFields(embed, options.members)

        embed.addFields({
            name: 'Started',
            value: formatPacificTime(run.startedAt),
            inline: true,
        })

        return embed.setFooter({ text: footer.join(' • ') })
    }

    if (run.status === 'paused') {
        footer.push('⏸️ Paused')

        const embed = new EmbedBuilder()
            .setColor(EmbedColor.paused)
            .setTitle(`⏸️ ${run.dungeon}`)
            .setDescription(`Paused • \`${elapsed}\``)

        if (options.members?.length) addPartyFields(embed, options.members)

        embed.addFields({
            name: 'Started',
            value: formatPacificTime(run.startedAt),
            inline: true,
        })

        return embed.setFooter({ text: footer.join(' • ') })
    }

    if (best) footer.push(`PB ${best}`)

    const embed = new EmbedBuilder()
        .setColor(EmbedColor.running)
        .setTitle(`⏱️ ${run.dungeon}`)
        .setDescription(`\`${elapsed}\``)

    if (options.members?.length) addPartyFields(embed, options.members)

    embed.addFields({
        name: 'Started',
        value: formatPacificTime(run.startedAt),
        inline: true,
    })

    return embed.setFooter({ text: footer.join(' • ') })
}
