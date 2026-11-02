import { ChatInputCommandInteraction, Client, MessageFlags } from "discord.js";
import { SlashCommand, EmbedColor, errorEmbed, infoEmbed, successEmbed } from "../utils/index.js";
import { buildRunEmbed, finishRun, formatElapsed, getPersonalBest } from "../timers.js";

export const Stop: SlashCommand = {
    name: "stop",
    description: "Stop the Dungeon Instance Timer",

    options: [],

    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const run = finishRun(interaction.channelId);
            if (!run) {
                await interaction.editReply({
                    embeds: [infoEmbed('There is no active run in this channel. Use `/start` to begin one.')],
                });
                return;
            }

            // compare against the previous record before this run
            const elapsedMs = (run.endedAt ?? Date.now()) - run.startedAt;
            const previousBestMs = getPersonalBest(run.guildId, run.dungeon, run.id);
            const newPersonalBest = previousBestMs !== null && elapsedMs < previousBestMs;
            const firstRun = previousBestMs === null;

            // freeze the live timer message with its final time and result
            if (run.messageId) {
                const channel = await client.channels.fetch(run.channelId).catch(() => null);
                if (channel?.isTextBased()) {
                    const message = await channel.messages.fetch(run.messageId).catch(() => null);
                    await message?.edit({
                        content: null,
                        embeds: [
                            buildRunEmbed(run, Date.now(), {
                                bestMs: previousBestMs,
                                newPersonalBest,
                                firstRun,
                            }),
                        ],
                    }).catch(() => null);
                }
            }

            const elapsed = formatElapsed(elapsedMs);
            const best = previousBestMs !== null ? formatElapsed(previousBestMs) : null;

            let summary = `Finished in \`${elapsed}\`.`;
            if (newPersonalBest && best)
                summary += `\n🎉 **New personal best!** (was \`${best}\`)`;
            else if (firstRun)
                summary += '\n📝 First recorded run.';
            else if (best)
                summary += `\nPB \`${best}\`.`;

            await interaction.editReply({
                embeds: [
                    successEmbed(
                        summary,
                        `🏁 ${run.dungeon}`,
                        newPersonalBest ? EmbedColor.personalBest : EmbedColor.finished,
                    ),
                ],
            });
        } catch (error) {
            console.error(`[Command: stop]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while stopping the Dungeon Instance Timer.')],
            });
        }
    }
}
