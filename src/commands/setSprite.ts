import {
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
} from "discord.js";
import { SlashCommand, errorEmbed, successEmbed } from "../utils/index.js";
import { isSpriteKey, setPlayerSprite, spriteKeys, spriteLabel } from "../core/index.js";

export const SetSprite: SlashCommand = {
    name: "set-sprite",
    description: "Set your WoW character sprite for dungeon runs",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "sprite",
            description: "Your character sprite",
            required: true,
            choices: spriteKeys().map(key => ({ name: spriteLabel(key), value: key })),
        },
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Set another member's sprite",
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

            const sprite = interaction.options.getString('sprite', true);
            if (!isSpriteKey(sprite)) {
                await interaction.editReply({
                    embeds: [errorEmbed('Choose a valid character sprite.')],
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

            setPlayerSprite(guild.id, targetMember.id, sprite);

            const message = isSelf
                ? `Your WoW character sprite is now **${spriteLabel(sprite)}**.`
                : `<@${targetMember.id}> is now using **${spriteLabel(sprite)}** as their character sprite.`;

            await interaction.editReply({
                embeds: [successEmbed(message, 'Sprite updated')],
            });
        } catch (error) {
            console.error(`[Command: set-sprite]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while setting the character sprite.')],
            });
        }
    },
}
