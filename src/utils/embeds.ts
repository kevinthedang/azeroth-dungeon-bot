import { EmbedBuilder } from 'discord.js'

/** Shared embed colors so every response feels like the same bot. */
export const EmbedColor = {
    running: 0x5865f2,
    finished: 0x57f287,
    personalBest: 0xfee75c,
    error: 0xed4245,
    info: 0x95a5a6,
} as const

export function infoEmbed(description: string, title?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(EmbedColor.info)
        .setDescription(description)

    if (title) embed.setTitle(title)

    return embed
}

export function successEmbed(
    description: string,
    title?: string,
    color: number = EmbedColor.finished,
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(description)

    if (title) embed.setTitle(title)

    return embed
}

export function errorEmbed(description: string, title?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(EmbedColor.error)
        .setDescription(description)

    if (title) embed.setTitle(title)

    return embed
}
