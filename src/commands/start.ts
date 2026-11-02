import { ChatInputCommandInteraction, Client } from "discord.js";
import { SlashCommand } from "../utils/index.js";


export const Start: SlashCommand = {
    name: "start",
    description: "Start the Dungeon Instance Timer",

    options: [],

    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        try {
            const channel = await client.channels.fetch(interaction.channelId)
            if (!channel) return
            await interaction.editReply({
                content: 'Starting the Dungeon Instance Timer...',
            });
        } catch (error) {
            console.error(`[Command: start]`, error);
            await interaction.editReply({
                content: 'An error occurred while starting the Dungeon Instance Timer.',
            });
        }
    }
}