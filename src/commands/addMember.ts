import {
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
} from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed, successEmbed } from "../utils/index.js";
import { addRunMember, getActiveRun, getRunMembers } from "../core/index.js";
import { MAX_PARTY_MEMBERS, updateRunMessage } from "../services/index.js";

export const AddMember: SlashCommand = {
    name: "add-member",
    description: "Add a server member to the active dungeon run party",

    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Server member to add to the active run",
            required: true,
        },
    ],

    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            if (!interaction.guild) {
                await interaction.editReply({
                    embeds: [errorEmbed('This command can only be used inside a server.')],
                });
                return;
            }

            const active = getActiveRun(interaction.channelId);
            if (!active) {
                await interaction.editReply({
                    embeds: [infoEmbed('There is no active run in this channel. Use `/start` to begin one.')],
                });
                return;
            }

            const user = interaction.options.getUser('user', true);
            const memberExists = interaction.guild.members.cache.get(user.id)
                ?? await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!memberExists) {
                await interaction.editReply({
                    embeds: [errorEmbed('That person is not a member of this server.')],
                });
                return;
            }

            const currentMembers = getRunMembers(active.id);
            const alreadyAdded = currentMembers.some(member => member.userId === user.id);
            if (alreadyAdded) {
                await interaction.editReply({
                    embeds: [infoEmbed(`<@${user.id}> is already in the active run party.`)],
                });
                return;
            }
            if (currentMembers.length >= MAX_PARTY_MEMBERS) {
                await interaction.editReply({
                    embeds: [errorEmbed(`A dungeon party can have at most ${MAX_PARTY_MEMBERS} members.`)],
                });
                return;
            }

            addRunMember(active.id, {
                userId: user.id,
                username: memberExists.user.username,
            });

            const updated = await updateRunMessage(client, active);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }

            await interaction.editReply({
                embeds: [successEmbed(`<@${user.id}> was added to the active run party.`)],
            });
        } catch (error) {
            console.error(`[Command: add-member]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while adding the party member.')],
            });
        }
    },
};
