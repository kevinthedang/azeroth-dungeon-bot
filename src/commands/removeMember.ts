import {
    ApplicationCommandOptionType,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
} from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed } from "../utils/index.js";
import { getActiveRun, getRunMembers, removeRunMember } from "../core/index.js";
import { updateRunMessage } from "../services/index.js";

export const RemoveMember: SlashCommand = {
    name: "remove-member",
    description: "Remove a member from the active dungeon run party",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "member",
            description: "Party member to remove",
            required: true,
            autocomplete: true,
        },
    ],

    autocomplete: async (_client: Client, interaction: AutocompleteInteraction) => {
        const active = getActiveRun(interaction.channelId);
        if (!active) {
            await interaction.respond([]);
            return;
        }

        const query = interaction.options.getFocused().trim().toLowerCase();
        const choices = getRunMembers(active.id)
            .map(member => ({
                name: member.wowName ?? member.username,
                value: member.userId,
            }))
            .filter(choice => choice.name.toLowerCase().includes(query))
            .slice(0, 25);

        await interaction.respond(choices);
    },

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

            const userId = interaction.options.getString('member', true).trim();
            const member = getRunMembers(active.id).find(member => member.userId === userId);
            if (!member) {
                await interaction.editReply({
                    embeds: [errorEmbed('That person is not in the active run party.')],
                });
                return;
            }

            removeRunMember(active.id, member.userId);

            const updated = await updateRunMessage(client, active);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }

            await interaction.editReply({
                embeds: [errorEmbed('The member was removed, but the timer message could not be updated.')],
            });
        } catch (error) {
            console.error(`[Command: remove-member]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while removing the party member.')],
            });
        }
    },
};
