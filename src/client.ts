import { Client, GatewayIntentBits } from 'discord.js'
import Keys from './keys.js'
import { registerEvents } from './utils/index.js'
import Events from './events/index.js'

// initialize the client with the specified intents/permissions
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
})

registerEvents(client, Events)

// log in the client with the bot token
client.login(Keys.clientToken)
    .catch((error) => {
            console.error('[Login Error]', error); 
            process.exit(1);
        }
    )