import {
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
    PermissionFlagsBits,
} from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed, successEmbed } from "../utils/index.js";
import { clearHistory } from "../timers.js";

export const Clear: SlashCommand = {
    name: "clear",
    description: "Clear the recorded history for a dungeon",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "dungeon",
            description: "Name of the dungeon whose history should be cleared",
            required: true,
            max_length: 100,
        },
    ],

    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            if (!interaction.guildId) {
                await interaction.editReply({
                    embeds: [errorEmbed('This command can only be used inside a server.')],
                });
                return;
            }

            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                await interaction.editReply({
                    embeds: [errorEmbed('You need the **Manage Server** permission to clear dungeon history.')],
                });
                return;
            }

            const dungeon = interaction.options.getString('dungeon', true).trim();
            if (!dungeon) {
                await interaction.editReply({
                    embeds: [errorEmbed('Please provide the name of the dungeon to clear.')],
                });
                return;
            }

            const { deleted, active } = clearHistory(interaction.guildId, dungeon);

            if (deleted === 0 && active === 0) {
                await interaction.editReply({
                    embeds: [infoEmbed(`No recorded history found for **${dungeon}**.`, 'Nothing to clear')],
                });
                return;
            }

            const parts = [`Cleared \`${deleted}\` completed run${deleted === 1 ? '' : 's'} for **${dungeon}**.`];

            if (active > 0) {
                parts.push(
                    `\`${active}\` run${active === 1 ? ' is' : 's are'} still in progress and ${active === 1 ? 'was' : 'were'} left untouched.`,
                );
            }

            await interaction.editReply({
                embeds: [successEmbed(parts.join('\n'), '🧹 Dungeon history cleared')],
            });
        } catch (error) {
            console.error(`[Command: clear]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while clearing the dungeon history.')],
            });
        }
    }
}
