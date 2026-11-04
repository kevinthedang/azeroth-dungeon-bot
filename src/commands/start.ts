import {
    ApplicationCommandOptionType,
    AttachmentBuilder,
    ChatInputCommandInteraction,
    Client,
} from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed, parseMemberTokens, resolveMemberTokens } from "../utils/index.js";
import {
    attachMessage,
    buildRunEmbed,
    formatElapsed,
    getActiveRun,
    getPersonalBest,
    getRunMembers,
    startRun,
    type RunMember,
} from "../core/index.js";
import { renderRunArtBuffer } from "../services/index.js";

export const Start: SlashCommand = {
    name: "start",
    description: "Start the Dungeon Instance Timer",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "dungeon",
            description: "Name of the dungeon being run (defaults to \"Dungeon\")",
            required: true,
            max_length: 100,
        },
        {
            type: ApplicationCommandOptionType.String,
            name: "members",
            description: "Comma-separated Discord usernames or mentions (e.g. alice, @bob)",
            required: true,
            max_length: 1000,
        },
    ],

    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            if (!guild) {
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

            // resolve the party against real guild members before creating the run
            const memberInput = interaction.options.getString('members')?.trim() ?? '';
            const tokens = parseMemberTokens(memberInput);
            let party: RunMember[] = [];

            if (tokens.length > 0) {
                const guildMembers = await guild.members.fetch();
                const { members, unknown, ambiguous } = resolveMemberTokens(guildMembers, tokens);

                if (unknown.length > 0 || ambiguous.length > 0) {
                    const lines: string[] = [];

                    if (unknown.length > 0)
                        lines.push(`Not in this server: ${unknown.map(name => `\`${name}\``).join(', ')}`);

                    if (ambiguous.length > 0)
                        lines.push(`Matched more than one member: ${ambiguous.map(name => `\`${name}\``).join(', ')}`);

                    lines.push('Use a unique Discord username or a mention so I can identify everyone.');

                    await interaction.editReply({
                        embeds: [errorEmbed(lines.join('\n'), 'Could not add everyone to the party')],
                    });
                    return;
                }

                party = members.map(member => ({
                    userId: member.id,
                    username: member.user.username,
                }));
            }

            const dungeon = interaction.options.getString('dungeon')?.trim() || 'Dungeon';
            const personalBestMs = getPersonalBest(guild.id, dungeon);
            const run = startRun(guild.id, interaction.channelId, dungeon, party);
            const members = getRunMembers(run.id);

            // render from the stored members so roles and sprites are included
            const art = await renderRunArtBuffer(dungeon, members);

            // the interaction reply doubles as the live timer message; the run
            // card rides along as a file attachment so Discord keeps it large
            const message = await interaction.editReply({
                embeds: [
                    buildRunEmbed(run, Date.now(), {
                        bestMs: personalBestMs,
                        members,
                        suppressImage: art !== null,
                    }),
                ],
                files: art
                    ? [new AttachmentBuilder(art, { name: `run-${run.id}.png` })]
                    : [],
                allowedMentions: { parse: [] },
            });
            attachMessage(run.id, message.id);
        } catch (error) {
            console.error(`[Command: start]`, error);
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while starting the Dungeon Instance Timer.')],
            });
        }
    },
}
