import { CommandInteraction,
    SlashCommandBuilder, 
} from "discord.js";
import { getOptionValue, getConnection} from "../utils/Interaction";

export const playurleffect = {
    data: new SlashCommandBuilder()
        .setName('playurleffect')
        .setDescription('Play a song from a URL')
        .addStringOption(option => 
            option.setName('url')
                .setDescription('The URL of the song to play')
                .setRequired(true)),
    async execute(interaction: CommandInteraction) {
        try{
            await interaction.deferReply();
            console.log("play url effect");
            const seUrl = getOptionValue<string>(interaction,'url');
            const seManager = getConnection(interaction).effectPlayer;
            seManager.playFromUrl(seUrl!);
            await interaction.editReply(`Playing song from URL: ${seUrl}`);
        }
        catch(error) {
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.editReply(errorMsg);    
        }
    }
};

export const toggleloopeffect = {
    data: new SlashCommandBuilder()
        .setName('toggleloopeffect')
        .setDescription('Toggle loop currently playing song')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of the sound effect toggle playing')
                .setRequired(true)),
    async execute(interaction: CommandInteraction){
        try{
            await interaction.deferReply();
            const name = getOptionValue<string>(interaction,'name');
            const seManager = getConnection(interaction).effectPlayer;
            const loop = seManager.toggleLoop(name!);
            await interaction.editReply(`${loop ? "Looping" : "Not looping" } sound effect: ${name}`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.editReply(errorMsg);    
        }
    }
}

export const playeffect = {
    data: new SlashCommandBuilder()
        .setName('playeffect')
        .setDescription('Play from effect list')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('The number of the song in the current track list you want to play')
                .setRequired(true)),
    async execute(interaction: CommandInteraction) {
        try{
            await interaction.deferReply();
            const name = getOptionValue<string>(interaction,'name');
            const seManager = getConnection(interaction).effectPlayer;
            const connection = getConnection(interaction);
            seManager.play(name!);
            await interaction.editReply(`Playing effect: ${name}`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.editReply(errorMsg);    
        }
    }
};

export const togglepauseeffect = {
    data: new SlashCommandBuilder()
        .setName('togglepauseeffect')
        .setDescription('Pause or play given effect')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('Name of the sound effect to pause')
                .setRequired(true)),
    async execute(interaction: CommandInteraction){
        try{
            await interaction.deferReply();
            const name : string = getOptionValue<string>(interaction,'name')!;
            const seManager = getConnection(interaction).effectPlayer;
            const playing = seManager.togglePause(name);
            await interaction.editReply(`${playing ? "Playing" : "Pausing" } currently playing effect: ${name}`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.editReply(errorMsg);    
        }
    }
}

export const addeffect = {
    data: new SlashCommandBuilder()
        .setName('addeffect')
        .setDescription('Add a sound effect from a URL, will replace on same name')
        .addStringOption(option => 
            option.setName('url')
                .setDescription('The URL of the sound effect to added')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of the sound effect to add')
                .setRequired(true))
        .addBooleanOption(option => 
            option.setName('loop')
                .setDescription('Set the effect to loop, default is false')),
    async execute(interaction: CommandInteraction) {
        try{
            await interaction.deferReply();
            const seUrl = getOptionValue<string>(interaction,'url');
            const seName = getOptionValue<string>(interaction,'name');
            const seLoop = getOptionValue<boolean>(interaction,'loop');
            console.log("Add Effect " + seUrl + " " + seName + " " + seLoop );
            const seManager = getConnection(interaction).effectPlayer;
            seManager.add(seUrl!, seName!, seLoop);
            await interaction.editReply(`Adding song to track list from URL: ${seUrl}`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.editReply(errorMsg);    
        }
    }
};

export const stopeffect = {
    data: new SlashCommandBuilder()
        .setName('stopeffect')
        .setDescription('Stop effect from playing')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of a playing effect to remove')
                .setRequired(true)),
    async execute(interaction: CommandInteraction) {
        try{
            await interaction.deferReply();
            const seName = getOptionValue<string>(interaction,'name');
            const seManager = getConnection(interaction).effectPlayer;
            seManager.stop(seName!);
            await interaction.editReply(`Stopping effect: ${seName} from playing`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.editReply(errorMsg);    
        }
    }
}

export const removeeffect = {
    data: new SlashCommandBuilder()
        .setName('removeeffect')
        .setDescription('Remove from sound effect list')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of the saved effect to remove')
                .setRequired(true)),
    async execute(interaction: CommandInteraction) {
        try{
            await interaction.deferReply();
            const seName = getOptionValue<string>(interaction,'name');
            const seManager = getConnection(interaction).effectPlayer;
            seManager.remove(seName!);
            await interaction.editReply(`Removing track: ${seName} from the effect list`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.editReply(errorMsg);    
        }
        
    }
}

export const listeffects = {
    data: new SlashCommandBuilder()
        .setName('listeffects')
        .setDescription('List all saved effects'),
    async execute(interaction: CommandInteraction){
        try{
            await interaction.deferReply();
            const seManager = getConnection(interaction).effectPlayer;
            const tracks = seManager.list();
            if(tracks && tracks.length > 0) await interaction.editReply(tracks.join('\n'));
            else await interaction.editReply("No effects");
        }catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.editReply(errorMsg);    
        }
    }
}



