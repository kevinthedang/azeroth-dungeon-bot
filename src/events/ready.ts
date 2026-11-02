import { ActivityType, Events } from 'discord.js'
import { event, registerCommands } from '../utils/index.js'
import commands from '../commands/index.js'

export default event(Events.ClientReady, ({ log }, client) => {
    registerCommands(client, commands)
    
    client.user.setActivity({
        name: 'Monitoring Azeroth',
        type: ActivityType.Custom
    })

    log(`Logged in as ${client.user.username}.`)
})