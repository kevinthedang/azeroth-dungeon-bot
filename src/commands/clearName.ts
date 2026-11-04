import {
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
} from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed, successEmbed } from "../utils/index.js";
import { clearPlayerName } from "../core/index.js";

export const ClearName: SlashCommand = {
    name: "clear-name",
    description: "Clear the WoW character name shown on your dungeon run card",

    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Member to clear the character name for",
            required: false,
        },
    ],

    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const guild = interaction.guild;
            if (!guild) {
                await interaction.editReply({
                    embeds: [errorEmbed('This command can only be used inside a server.')],
                });
                return;
            }

            const targetUser = interaction.options.getUser('user') ?? interaction.user;
            const isSelf = targetUser.id === interaction.user.id;

            const targetMember = guild.members.cache.get(targetUser.id)
                ?? await guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                await interaction.editReply({
                    embeds: [errorEmbed('That user is not in this server.')],
                });
                return;
            }

            const cleared = clearPlayerName(guild.id, targetMember.id);
            const message = isSelf && !cleared
                ? 'You do not have a character name set. Your Discord name is already used.'
                : isSelf
                    ? 'Your character name was cleared. Run cards will use your Discord name again.'
                    : `<@${targetMember.id}>'s character name was cleared.`;

            await interaction.editReply({
                embeds: [cleared ? successEmbed(message, 'Character name cleared') : infoEmbed(message, 'Character name cleared')],
            });
        } catch (error) {
            console.error(`[Command: clear-name]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while clearing the character name.')],
            });
        }
    },
}
