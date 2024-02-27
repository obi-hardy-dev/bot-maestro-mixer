import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { getConnection } from "../utils/Interaction";


export const stop = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop currently playing song'),
    async execute(interaction: CommandInteraction) {
        try {
            const connection = getConnection(interaction);
            const mplayer = connection.musicPlayer;
            const wasPlaying = mplayer.currentlyPlaying();
            const playing = mplayer.stop();
            await interaction.reply(`Stopping currently playing song: ${wasPlaying}`);
        }
        catch (error) {
            let errorMsg = "Error occurred.";
            if (error instanceof Error) {
                errorMsg = error.message;
            }
            await interaction.reply(errorMsg);
        }
    }
};

