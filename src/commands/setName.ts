import {
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
} from "discord.js";
import { SlashCommand, errorEmbed, successEmbed } from "../utils/index.js";
import {
    normalizeWowName,
    setPlayerName,
    WOW_NAME_MAX_LENGTH,
    WOW_NAME_MIN_LENGTH,
} from "../core/index.js";

export const SetName: SlashCommand = {
    name: "set-name",
    description: "Set the WoW character name shown on your dungeon run card",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "name",
            description: "Your WoW character name",
            required: true,
            min_length: WOW_NAME_MIN_LENGTH,
            max_length: WOW_NAME_MAX_LENGTH,
        },
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Set another member's character name",
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

            const input = interaction.options.getString('name', true);
            const name = normalizeWowName(input);

            if (!name) {
                await interaction.editReply({
                    embeds: [
                        errorEmbed(
                            `**${input.trim()}** is not a valid character name. Use ${WOW_NAME_MIN_LENGTH}–${WOW_NAME_MAX_LENGTH} letters — apostrophes and hyphens are allowed.`,
                            'Invalid character name',
                        ),
                    ],
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

            setPlayerName(guild.id, targetMember.id, name);

            const message = isSelf
                ? `Your run card will now show **${name}** instead of your Discord name.`
                : `<@${targetMember.id}> will now show **${name}** on run cards.`;

            await interaction.editReply({
                embeds: [successEmbed(message, 'Character name updated')],
            });
        } catch (error) {
            console.error(`[Command: set-name]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while setting the character name.')],
            });
        }
    },
}
