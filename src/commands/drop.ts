import {
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
} from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed } from "../utils/index.js";
import { addRunDrop, getActiveRun, getRunMembers, type RunMember } from "../core/index.js";
import { updateRunMessage } from "../services/index.js";

export const Drop: SlashCommand = {
    name: "drop",
    description: "Record an item dropped during the active dungeon run",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "boss",
            description: "Name of the boss that dropped the item",
            required: true,
            max_length: 100,
        },
        {
            type: ApplicationCommandOptionType.String,
            name: "item",
            description: "Name of the item that dropped",
            required: true,
            max_length: 200,
        },
        {
            type: ApplicationCommandOptionType.Boolean,
            name: "vendored",
            description: "Whether the item was vendored",
            required: true,
        },
        {
            type: ApplicationCommandOptionType.User,
            name: "member",
            description: "Party member who received the item",
            required: false,
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

            const boss = interaction.options.getString('boss', true).trim();
            const item = interaction.options.getString('item', true).trim();
            const vendored = interaction.options.getBoolean('vendored', true);

            if (!boss) {
                await interaction.editReply({
                    embeds: [errorEmbed('The boss name cannot be empty.')],
                });
                return;
            }

            if (!item) {
                await interaction.editReply({
                    embeds: [errorEmbed('The item name cannot be empty.')],
                });
                return;
            }

            let member: RunMember | null = null;
            if (!vendored) {
                const recipient = interaction.options.getUser('member');
                if (!recipient) {
                    await interaction.editReply({
                        embeds: [errorEmbed('Choose the party member who received the item when `vendored` is false.')],
                    });
                    return;
                }

                member = getRunMembers(active.id).find(member => member.userId === recipient.id) ?? null;
                if (!member) {
                    await interaction.editReply({
                        embeds: [errorEmbed('The selected member is not in the active run party.')],
                    });
                    return;
                }
            }

            addRunDrop(active.id, boss, item, vendored, member);

            const updated = await updateRunMessage(client, active);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }

            await interaction.editReply({
                embeds: [errorEmbed('The drop was recorded, but the timer message could not be updated.')],
            });
        } catch (error) {
            console.error(`[Command: drop]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while recording the drop.')],
            });
        }
    },
};
