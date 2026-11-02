import { Events } from 'discord.js'
import { event } from '../utils/index.js'

export default event(Events.ClientReady, ({ log }, client) => {
    
    
    log(`Logged in as ${client.user.username}.`)
})