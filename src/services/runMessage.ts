import type { Client } from 'discord.js'
import { buildRunEmbed, getPersonalBest, getRunMembers, type DungeonRun } from '../core/index.js'

export interface RunMessageOptions {
    bestMs?: number | null | undefined
    newPersonalBest?: boolean | undefined
    firstRun?: boolean | undefined
}

/**
 * Re-render a run's stored Discord message. Returns `false` when the message no
 * longer exists or could not be edited, so callers can fall back to a reply.
 */
export async function updateRunMessage(
    client: Client,
    run: DungeonRun,
    options: RunMessageOptions = {},
): Promise<boolean> {
    if (!run.messageId) return false

    const channel = await client.channels.fetch(run.channelId).catch(() => null)
    if (!channel?.isTextBased()) return false

    const message = await channel.messages.fetch(run.messageId).catch(() => null)
    if (!message) return false

    const bestMs = options.bestMs !== undefined
        ? options.bestMs
        : getPersonalBest(run.guildId, run.dungeon, run.id)

    const edited = await message.edit({
        content: null,
        embeds: [
            buildRunEmbed(run, Date.now(), {
                bestMs,
                newPersonalBest: options.newPersonalBest,
                firstRun: options.firstRun,
                members: getRunMembers(run.id),
            }),
        ],
        allowedMentions: { parse: [] },
    }).catch(() => null)

    return edited !== null
}
