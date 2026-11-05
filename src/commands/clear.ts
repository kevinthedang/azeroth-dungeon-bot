import {
    ApplicationCommandOptionType,
    type AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
    PermissionFlagsBits,
} from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed, successEmbed } from "../utils/index.js";
import { clearHistory, DUNGEONS, formatDungeonChoice } from "../core/index.js";

export const Clear: SlashCommand = {
    name: "clear",
    description: "Clear the recorded history for a dungeon",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "dungeon",
            description: "Name of the dungeon whose history should be cleared",
            required: true,
            autocomplete: true,
        },
    ],

    autocomplete: async (_client: Client, interaction: AutocompleteInteraction) => {
        const query = interaction.options.getFocused().toLowerCase()
        const matches = DUNGEONS
            .filter(dungeon => formatDungeonChoice(dungeon).toLowerCase().includes(query))
            .slice(0, 25)
            .map(dungeon => ({ name: formatDungeonChoice(dungeon), value: dungeon }))

        await interaction.respond(matches)
    },

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
            if (!DUNGEONS.some(supported => supported === dungeon)) {
                await interaction.editReply({
                    embeds: [errorEmbed(`Choose one of the available dungeons: ${DUNGEONS.join(', ')}.`)],
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
