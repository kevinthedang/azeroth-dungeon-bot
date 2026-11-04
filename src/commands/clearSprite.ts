import {
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
} from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed, successEmbed } from "../utils/index.js";
import { clearPlayerSprite, getPlayerSprite } from "../core/index.js";

export const ClearSprite: SlashCommand = {
    name: "clear-sprite",
    description: "Clear the WoW character sprite for a dungeon run party member",

    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Member to clear the sprite for",
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

            const cleared = clearPlayerSprite(guild.id, targetMember.id);
            const message = isSelf && !cleared
                ? 'You do not have a character sprite set.'
                : isSelf
                    ? 'Your WoW character sprite was cleared. You will show no sprite during dungeon runs.'
                    : `<@${targetMember.id}>'s WoW character sprite was cleared.`;

            await interaction.editReply({
                embeds: [cleared ? successEmbed(message, 'Sprite cleared') : infoEmbed(message, 'Sprite cleared')],
            });
        } catch (error) {
            console.error(`[Command: clear-sprite]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while clearing the character sprite.')],
            });
        }
    },
}
