import { ChatInputCommandInteraction, Client, MessageFlags } from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed } from "../utils/index.js";
import { getActiveRun, resumeRun } from "../core/index.js";
import { updateRunMessage } from "../services/index.js";

export const Resume: SlashCommand = {
    name: "resume",
    description: "Resume a paused Dungeon Instance Timer",

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

            if (active.status !== 'paused') {
                await interaction.editReply({
                    embeds: [infoEmbed('This run is not paused. Use `/pause` to pause it.')],
                });
                return;
            }

            const run = resumeRun(interaction.channelId);
            if (!run) {
                await interaction.editReply({
                    embeds: [errorEmbed('The run could not be resumed.')],
                });
                return;
            }

            const updated = await updateRunMessage(client, run);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }

            await interaction.editReply({
                embeds: [errorEmbed('The run was resumed, but its timer message could not be updated.')],
            });
        } catch (error) {
            console.error(`[Command: resume]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while resuming the Dungeon Instance Timer.')],
            });
        }
    }
}
