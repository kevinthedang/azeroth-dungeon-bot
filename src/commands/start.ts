import {
    ApplicationCommandOptionType,
    AttachmentBuilder,
    type AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
} from "discord.js";
import { SlashCommand, errorEmbed, infoEmbed, parseMemberTokens, resolveMemberTokens } from "../utils/index.js";
import {
    attachMessage,
    buildRunEmbed,
    DUNGEONS,
    formatElapsed,
    getActiveRun,
    getPersonalBest,
    getRunMembers,
    startRun,
    type RunMember,
} from "../core/index.js";
import { ART_FILENAME, MAX_PARTY_MEMBERS, renderRunArtBuffer } from "../services/index.js";

export const Start: SlashCommand = {
    name: "start",
    description: "Start the Dungeon Instance Timer",

    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "dungeon",
            description: "Dungeon being run",
            required: true,
            autocomplete: true,
        },
        {
            type: ApplicationCommandOptionType.String,
            name: "members",
            description: "Comma-separated Discord usernames or mentions (e.g. alice, @bob)",
            required: true,
            max_length: 1000,
        },
    ],

    autocomplete: async (_client: Client, interaction: AutocompleteInteraction) => {
        const query = interaction.options.getFocused().toLowerCase()
        const matches = DUNGEONS
            .filter(dungeon => dungeon.toLowerCase().includes(query))
            .slice(0, 25)
            .map(dungeon => ({ name: dungeon, value: dungeon }))

        await interaction.respond(matches)
    },

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
                if (tokens.length > MAX_PARTY_MEMBERS) {
                    await interaction.editReply({
                        embeds: [errorEmbed(`A dungeon party can have at most ${MAX_PARTY_MEMBERS} members.`)],
                    });
                    return;
                }

                const guildMembers = guild.members.cache.clone();

                for (const token of tokens) {
                    const mention = token.match(/^<@!?(\d+)>$/);
                    if (mention) {
                        const userId = mention[1]!;
                        if (!guildMembers.has(userId)) {
                            const member = await guild.members.fetch(userId).catch(() => null);
                            if (member) guildMembers.set(userId, member);
                        }
                        continue;
                    }

                    if (typeof guild.members.search === 'function') {
                        const matches = await guild.members.search({
                            query: token.replace(/^"|"$/g, ''),
                            limit: 100,
                        }).catch(() => guildMembers);

                        for (const [userId, member] of matches) {
                            guildMembers.set(userId, member);
                        }
                    }
                }

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

            const dungeon = interaction.options.getString('dungeon', true).trim();
            if (!DUNGEONS.some(supported => supported === dungeon)) {
                await interaction.editReply({
                    embeds: [errorEmbed(`Choose one of the available dungeons: ${DUNGEONS.join(', ')}.`)],
                });
                return;
            }
            const personalBestMs = getPersonalBest(guild.id, dungeon);
            const run = startRun(guild.id, interaction.channelId, dungeon, party);
            const members = getRunMembers(run.id);

            // render from the stored members so roles and sprites are included
            const art = await renderRunArtBuffer(dungeon, members);

            // the card rides along as a file but is referenced from inside the
            // embed, so it shows in the embed (and is hidden as an attachment)
            const message = await interaction.editReply({
                embeds: [
                    buildRunEmbed(run, Date.now(), {
                        bestMs: personalBestMs,
                        members,
                        artUrl: art ? `attachment://${ART_FILENAME}` : null,
                    }),
                ],
                files: art ? [new AttachmentBuilder(art, { name: ART_FILENAME })] : [],
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
