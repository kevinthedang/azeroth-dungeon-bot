import { ActivityType, Events } from 'discord.js'
import { event, registerCommands } from '../utils/index.js'
import { startTimerService } from '../services/timerService.js'
import commands from '../commands/index.js'

export default event(Events.ClientReady, ({ log }, client) => {
    registerCommands(client, commands)

    // resume live timers for any runs that were active before a restart
    startTimerService(client)

    client.user.setActivity({
        name: 'Monitoring Azeroth',
        type: ActivityType.Custom
    })

    log(`Logged in as ${client.user.username}.`)
})
