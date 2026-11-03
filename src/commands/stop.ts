import { ChatInputCommandInteraction, Client, MessageFlags } from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed } from "../utils/index.js";
import { finishRun, getElapsedMs, getPersonalBest } from "../core/index.js";
import { updateRunMessage } from "../services/index.js";

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

            // compare against the previous record, excluding paused time
            const elapsedMs = getElapsedMs(run);
            const previousBestMs = getPersonalBest(run.guildId, run.dungeon, run.id);
            const newPersonalBest = previousBestMs !== null && elapsedMs < previousBestMs;
            const firstRun = previousBestMs === null;

            const updated = await updateRunMessage(client, run, {
                bestMs: previousBestMs,
                newPersonalBest,
                firstRun,
            });

            // the public timer message now holds the result, so drop the
            // redundant ephemeral reply
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }

            await interaction.editReply({
                embeds: [errorEmbed('The run was stopped, but its timer message could not be updated.')],
            });
        } catch (error) {
            console.error(`[Command: stop]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while stopping the Dungeon Instance Timer.')],
            });
        }
    }
}
