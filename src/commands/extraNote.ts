import { ApplicationCommandOptionType, ChatInputCommandInteraction, Client, MessageFlags } from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed } from "../utils/index.js";
import { addRunNote, getActiveRun } from "../core/index.js";
import { updateRunMessage } from "../services/index.js";

export const ExtraNote: SlashCommand = {
    name: "extra-note",
    description: "Add an extra note to the active Dungeon Instance Timer",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "text",
            description: "Note to add to the timer message",
            required: true,
            max_length: 500,
        },
    ],

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

            const text = interaction.options.getString('text', true).trim();
            if (!text) {
                await interaction.editReply({
                    embeds: [errorEmbed('The extra note cannot be empty.')],
                });
                return;
            }

            addRunNote(active.id, text);

            const updated = await updateRunMessage(client, active);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }

            await interaction.editReply({
                embeds: [errorEmbed('The note was added, but the timer message could not be updated.')],
            });
        } catch (error) {
            console.error(`[Command: extra-note]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while adding the extra note.')],
            });
        }
    },
};
