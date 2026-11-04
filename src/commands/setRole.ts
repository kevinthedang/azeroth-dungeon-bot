import {
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
} from "discord.js";
import { SlashCommand, errorEmbed, successEmbed } from "../utils/index.js";
import { WOW_ROLES, isWowRole, setPlayerRole } from "../core/index.js";

export const SetRole: SlashCommand = {
    name: "set-role",
    description: "Set your WoW role for dungeon runs",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "role",
            description: "Your role in the group",
            required: true,
            choices: WOW_ROLES.map(role => ({ name: role, value: role })),
        },
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Set another member's role (requires Manage Server)",
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

            const role = interaction.options.getString('role', true);
            if (!isWowRole(role)) {
                await interaction.editReply({
                    embeds: [errorEmbed(`Choose one of: ${WOW_ROLES.join(', ')}.`)],
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

            setPlayerRole(guild.id, targetMember.id, role);

            const message = isSelf
                ? `Your WoW role is now **${role}**.`
                : `<@${targetMember.id}> is now **${role}**.`;

            await interaction.editReply({
                embeds: [successEmbed(message, 'Role updated')],
            });
        } catch (error) {
            console.error(`[Command: set-role]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while setting the role.')],
            });
        }
    }
}
