import { ChatInputCommandInteraction, Client, MessageFlags } from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed } from "../utils/index.js";
import { getActiveRun, pauseRun } from "../core/index.js";
import { updateRunMessage } from "../services/index.js";

export const Pause: SlashCommand = {
    name: "pause",
    description: "Pause the Dungeon Instance Timer",

    options: [],

    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const active = getActiveRun(interaction.channelId);
            if (!active) {
                await interaction.editReply({
                    embeds: [infoEmbed('There is no active run in this channel. Use `/start` to begin one.')],
                });
                return;
            }

            if (active.status === 'paused') {
                await interaction.editReply({
                    embeds: [infoEmbed('This run is already paused. Use `/resume` to continue it.')],
                });
                return;
            }

            const run = pauseRun(interaction.channelId);
            if (!run) {
                await interaction.editReply({
                    embeds: [errorEmbed('The run could not be paused.')],
                });
                return;
            }

            const updated = await updateRunMessage(client, run);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }

            await interaction.editReply({
                embeds: [errorEmbed('The run was paused, but its timer message could not be updated.')],
            });
        } catch (error) {
            console.error(`[Command: pause]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while pausing the Dungeon Instance Timer.')],
            });
        }
    }
}
