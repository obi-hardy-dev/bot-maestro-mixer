import { CommandInteraction,
    SlashCommandBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageActionRowComponentBuilder, 
    parseEmoji,
    Emoji
} from "discord.js";
import { getConnection } from "../utils/Interaction";



export const save = {
    data: new SlashCommandBuilder()
        .setName('save')
        .setDescription('Save the current state of the MusicPlayer and Sound Effect Manager'),
    async execute(interaction: CommandInteraction) {
        console.log("save mp and sem");
        try{
            const connection = getConnection(interaction);

            await connection.musicPlayer.save();
            await connection.effectPlayer.save();

            await interaction.reply(`Saving state`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.reply(errorMsg);    
        }
    }
};

export const load = {
    data: new SlashCommandBuilder()
        .setName('load')
        .setDescription('Load the current state of the MusicPlayer and Sound Effect Manager'),
    async execute(interaction: CommandInteraction) {
        console.log("load mp and sem");
        try{
            const connection = getConnection(interaction);

            await connection.musicPlayer.load();
            await connection.effectPlayer.load();

            await interaction.reply(`Loaded`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.reply(errorMsg);    
        }
    }
};

export const showcontrols = {
    data: new SlashCommandBuilder()
        .setName('showcontrols')
        .setDescription('Show the UI controls for maestro'),
    async execute(interaction: CommandInteraction) {
        console.log("Show controls");
        try{
            await interaction.reply({
              content: 'Music player controls:',
              components: createMusicPlayerControls(),
            });
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.reply(errorMsg);    
        }
    }
};

function createMusicPlayerControls(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const musicControls = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setEmoji({ name: "⏮️" })
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('play')
        .setEmoji({ name: "▶️" })
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('pause')
        .setEmoji({ name: "⏸️" })
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('next')
        .setEmoji({ name: "⏯️" })
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('stop')
        .setEmoji({ name: "⏹️" })
        .setStyle(ButtonStyle.Danger),
      // Add more buttons as needed
    );

  return [musicControls];
}
