import { ApplicationCommandOptionType, ChatInputCommandInteraction, Client } from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed } from "../utils/index.js";
import { attachMessage, buildRunEmbed, formatElapsed, getActiveRun, getPersonalBest, startRun } from "../timers.js";

export const Start: SlashCommand = {
    name: "start",
    description: "Start the Dungeon Instance Timer",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "dungeon",
            description: "Name of the dungeon being run (defaults to \"Dungeon\")",
            required: false,
            max_length: 100,
        },
    ],

    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        try {
            if (!interaction.guildId) {
                await interaction.editReply({
                    embeds: [errorEmbed('This command can only be used inside a server.')],
                });
                return;
            }

            const active = getActiveRun(interaction.channelId);
            if (active) {
                const elapsed = formatElapsed(Date.now() - active.startedAt);
                await interaction.editReply({
                    embeds: [
                        infoEmbed(
                            `**${active.dungeon}** has been running for \`${elapsed}\` in this channel. Use \`/stop\` first.`,
                            'Run already in progress',
                        ),
                    ],
                });
                return;
            }

            const dungeon = interaction.options.getString('dungeon')?.trim() || 'Dungeon';
            const personalBestMs = getPersonalBest(interaction.guildId, dungeon);
            const run = startRun(interaction.guildId, interaction.channelId, dungeon);

            // the interaction reply doubles as the live timer message
            const message = await interaction.editReply({
                embeds: [buildRunEmbed(run, Date.now(), { bestMs: personalBestMs })],
            });
            attachMessage(run.id, message.id);
        } catch (error) {
            console.error(`[Command: start]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while starting the Dungeon Instance Timer.')],
            });
        }
    }
}
