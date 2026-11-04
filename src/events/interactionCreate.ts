import { MessageFlags } from 'discord.js'
import { errorEmbed, event, Events } from '../utils/index.js'
import commands from '../commands/index.js'

/**
 * Interaction creation listener for the client
 * @param interaction the interaction received from the server
 */
export default event(Events.InteractionCreate, async ({ log, client }, interaction) => {
    if (interaction.isAutocomplete()) {
        const command = commands.find(command => command.name === interaction.commandName)
        if (!command?.autocomplete) return

        try {
            await command.autocomplete(client, interaction)
        } catch (error) {
            console.error(`[Command: ${command.name}] autocomplete failed`, error)
            await interaction.respond([]).catch(() => null)
        }
        return
    }

    if (!interaction.isChatInputCommand()) return

    log(`Interaction called '${interaction.commandName}' from ${interaction.user.tag}.`)

    // ensure command exists, otherwise kill event
    const command = commands.find(command => command.name === interaction.commandName)
    if (!command) return

    // the command exists, execute it and surface any failure to the user
    try {
        await command.run(client, interaction)
    } catch (error) {
        console.error(`[Command: ${command.name}]`, error)

        if (!interaction.isRepliable()) return

        const embeds = [errorEmbed('Something went wrong while running that command.')]

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds }).catch(() => null)
        } else {
            await interaction.reply({ embeds, flags: MessageFlags.Ephemeral }).catch(() => null)
        }
    }
})
