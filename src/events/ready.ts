import { ActivityType, Events } from 'discord.js'
import { event, registerCommands } from '../utils/index.js'
import { startTimerService } from '../services/index.js'
import commands from '../commands/index.js'
import { registerSpriteEmojis } from '../core/index.js'

export default event(Events.ClientReady, ({ log }, client) => {
    // resolve sprite emoji before the first embed is rendered
    void registerSpriteEmojis(client).catch(error =>
        log('[Sprites] Could not load application emoji:', error),
    )

    registerCommands(client, commands)

    // resume live timers for any runs that were active before a restart
    startTimerService(client)

    client.user.setActivity({
        name: 'Monitoring Azeroth',
        type: ActivityType.Custom
    })

    log(`Logged in as ${client.user.username}.`)
})
