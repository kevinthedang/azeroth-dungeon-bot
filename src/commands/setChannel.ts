import {
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js'
import { SlashCommand, errorEmbed, successEmbed } from '../utils/index.js'
import { setCommandChannel } from '../core/index.js'

export const SetChannel: SlashCommand = {
    name: 'set-channel',
    description: 'Allow bot commands in this channel and its threads only',

    run: async (_client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        try {
            if (!interaction.guildId) {
                await interaction.editReply({
                    embeds: [errorEmbed('This command can only be used inside a server.')],
                })
                return
            }

            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.editReply({
                    embeds: [errorEmbed('Only administrators can set the bot command channel.')],
                })
                return
            }

            const allowedChannelId = interaction.channel?.isThread()
                ? interaction.channel.parentId ?? interaction.channelId
                : interaction.channelId
            setCommandChannel(interaction.guildId, allowedChannelId)

            await interaction.editReply({
                embeds: [successEmbed(
                    `Bot commands are now restricted to <#${allowedChannelId}> and its threads.`,
                    'Command channel set',
                )],
            })
        } catch (error) {
            console.error('[Command: set-channel]', error)
            await interaction.editReply({
                embeds: [errorEmbed('An error occurred while setting the bot command channel.')],
            })
        }
    },
}
