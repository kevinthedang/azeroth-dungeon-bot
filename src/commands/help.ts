import { ChatInputCommandInteraction, Client, MessageFlags } from 'discord.js'
import { SlashCommand, infoEmbed } from '../utils/index.js'

const commandSections = [
    { title: 'Run Management', names: ['start', 'stop', 'add-member', 'remove-member', 'drop', 'extra-note'] },
    { title: 'Character Profiles', names: ['set-name', 'clear-name', 'set-role', 'set-sprite', 'clear-sprite'] },
    { title: 'History', names: ['clear'] },
    { title: 'Bot Settings', names: ['set-channel'] },
    { title: 'Help', names: ['help'] },
]

export function createHelpCommand(commands: SlashCommand[]): SlashCommand {
    const helpCommand: SlashCommand = {
        name: 'help',
        description: 'Show available bot commands and their options',

        run: async (_client: Client, interaction: ChatInputCommandInteraction) => {
            const allCommands = [...commands, helpCommand]
            const formatCommand = (command: SlashCommand) => {
                const options = command.options
                    ?.map(option => {
                        const required = 'required' in option && option.required
                        return `${required ? '<' : '['}${option.name}${required ? '>' : ']'}`
                    })
                    .join(' ')
                const usage = options ? ` ${options}` : ''

                return `**/${command.name}${usage}**\n${command.description}`
            }
            const sectionFields = commandSections.flatMap(section => {
                const sectionCommands = section.names
                    .map(name => allCommands.find(command => command.name === name))
                    .filter((command): command is SlashCommand => command !== undefined)

                if (sectionCommands.length === 0) return []
                return [{
                    name: section.title,
                    value: sectionCommands.map(formatCommand).join('\n\n'),
                }]
            })
            const fields = sectionFields.flatMap((field, index) => index === sectionFields.length - 1
                ? [field]
                : [field, { name: '\u200b', value: '\u200b', inline: false }])

            await interaction.reply({
                embeds: [infoEmbed('Commands grouped by task.', 'Available commands').addFields(fields)],
                flags: MessageFlags.Ephemeral,
            })
        },
    }

    return helpCommand
}