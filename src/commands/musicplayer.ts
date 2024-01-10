import { CommandInteraction,
    Guild, 
    GuildMember, 
    SlashCommandBuilder, 
    VoiceBasedChannel, } from "discord.js";
import MusicPlayer from "../MusicPlayer";
import { Connection } from "../ConnectionManager";
import { connectionManagerInstance as connectionManager } from "../index"

const musicPlayers = new Map<string, MusicPlayer>();

function getOptionValue<T>(interaction: CommandInteraction, name: string) : T | undefined{
    const option = interaction.options.get(name);

    return option ? option.value as T : undefined;
}

function getConnection(interaction: CommandInteraction) : Connection {
    try{
        const guild = interaction.guild!;
        const channel = getVoiceBasedChannel(interaction)!;
        return connectionManager.connect(guild, channel);
    } catch(error) {
        let errorMsg = "Error occurred.";
        if(error instanceof Error){
            errorMsg = error.message;
        }
        console.log(errorMsg);    
        throw new Error(errorMsg);
    } 
}

function getMusicPlayer(guild: Guild) : MusicPlayer {
    const guildId = guild.id;
    let mplayer = musicPlayers.get(guildId);
    if(!mplayer){
        mplayer = new MusicPlayer(guild);
        musicPlayers.set(guildId, mplayer);
    }
    return mplayer;
}

function getVoiceBasedChannel(interaction: CommandInteraction) : VoiceBasedChannel {
    const member = interaction.member as GuildMember;//|| await interaction.guild.members.fetch(interaction.user.id);
    const channel = member?.voice.channel;
    if(!channel || !channel.isVoiceBased) {
        throw new Error(`Must be in a voice channel to use this request`);
    }
    return channel;
}

export const playurl = {
    data: new SlashCommandBuilder()
        .setName('playurl')
        .setDescription('Play a song from a URL')
        .addStringOption(option => 
            option.setName('url')
                .setDescription('The URL of the song to play')
                .setRequired(true)),
    async execute(interaction: CommandInteraction) {
        console.log("play from url")
        try{
            const songUrl = getOptionValue<string>(interaction,'url');
            const mplayer = getMusicPlayer(interaction.guild!);
            const connection = getConnection(interaction);
            mplayer.playFromUrl(connection, songUrl!);
            await interaction.reply(`Playing song from URL: ${songUrl}`);
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

export const toggleloop = {
    data: new SlashCommandBuilder()
        .setName('toggleloop')
        .setDescription('Toggle loop currently playing song'),
    async execute(interaction: CommandInteraction){
        try{
            const mplayer = getMusicPlayer(interaction.guild!);
            mplayer.loop = !mplayer.loop;
            await interaction.reply(`${mplayer.loop ? "Looping" : "Not looping" } currently playing song: ${mplayer.currentlyPlaying()}`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.reply(errorMsg);    
        }
    }
}

export const play = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play from track list')
        .addNumberOption(option => 
            option.setName('num')
                .setDescription('The number of the song in the current track list you want to play')),
    async execute(interaction: CommandInteraction) {
        try{
            const num = getOptionValue<number>(interaction,'num');
            const mplayer = getMusicPlayer(interaction.guild!);
            const connection = getConnection(interaction);
            mplayer.play(connection, num);
            await interaction.reply(`Playing song at: ${num}`);
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

export const togglepause = {
    data: new SlashCommandBuilder()
        .setName('togglepause')
        .setDescription('Pause or play currently playing song'),
    async execute(interaction: CommandInteraction){
        try{
            const mplayer = getMusicPlayer(interaction.guild!);
            getConnection(interaction);

            const playing = mplayer.togglePause();
            await interaction.reply(`${playing ? "Playing" : "Pausing" } currently playing song: ${mplayer.currentlyPlaying()}`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.reply(errorMsg);    
        }
    }
}

export const add = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a song from a URL')
        .addStringOption(option => 
            option.setName('url')
                .setDescription('The URL of the song to add to queue')
                .setRequired(true)),
    async execute(interaction: CommandInteraction) {
        const songUrl = getOptionValue<string>(interaction,'url');
        const mplayer = getMusicPlayer(interaction.guild!);
        mplayer.add(interaction);
        await interaction.reply(`Adding song to track list from URL: ${songUrl}`);
    }
};


export const join = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join voice channel'),
    async execute(interaction: CommandInteraction){
        try{
            //const channel : VoiceBasedChannel | undefined = getChannel(interaction);
            //if(!channel || !channel.isVoiceBased) return await interaction.reply(`Must be in a voice channel to request a join`); 

            const channel = getVoiceBasedChannel(interaction);
            const connection = connectionManager.connect(interaction.guild!, channel);
        
            if(connection) {
                await interaction.reply(`Joining ${channel.name}`);
            }
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.reply(errorMsg);    
        }
    }
}

export const remove = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove from track list')
        .addNumberOption(option => 
            option.setName('tracknum')
                .setDescription('The number of the song in the queue to remove')),
    async execute(interaction: CommandInteraction) {
        try{
            const tracknum = getOptionValue<number>(interaction,'tracknum');
            const mplayer = getMusicPlayer(interaction.guild!);
            mplayer.remove(tracknum);
            await interaction.reply(`Removing track: ${tracknum} from the track list`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.reply(errorMsg);    
        }
        
    }
}

export const leave = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Leave voice channel'),
    async execute(interaction: CommandInteraction){
        getConnection(interaction);
        connectionManager.disconnect(interaction.guild!.id)
        await interaction.reply(`Leaving channel`);
    } 
}

export const listtracks = {
    data: new SlashCommandBuilder()
        .setName('listtracks')
        .setDescription('List currently queued tracks'),
    async execute(interaction: CommandInteraction){
        const mplayer = getMusicPlayer(interaction.guild!);
        const tracks = mplayer.list();
        if(tracks && tracks.length > 0) await interaction.reply(tracks.toString());
        else await interaction.reply("No tracks");
    }
}

export const next = {
    data: new SlashCommandBuilder()
        .setName('next')
        .setDescription('Play next queued track'),
    async execute(interaction: CommandInteraction){
        try{
            const mplayer = getMusicPlayer(interaction.guild!);
            const channel = getVoiceBasedChannel(interaction);
            const connection = connectionManager.connect(interaction.guild!, channel);

            mplayer.next(connection);

            await interaction.reply(`Playing next song: ${mplayer.currentlyPlaying()}`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.reply(errorMsg);    
        }
    }
}

export const prev = {
    data: new SlashCommandBuilder()
        .setName('prev')
        .setDescription('Play previously queued track'),
    async execute(interaction: CommandInteraction){
        try{
            const mplayer = getMusicPlayer(interaction.guild!);
            const channel = getVoiceBasedChannel(interaction);
            const connection = connectionManager.connect(interaction.guild!, channel);
            mplayer.prev(connection);
            await interaction.reply(`Playing previous song: ${mplayer.currentlyPlaying()}`);
        }
        catch(error){
            let errorMsg = "Error occurred.";
            if(error instanceof Error){
                errorMsg = error.message;
            }
            await interaction.reply(errorMsg);    
        }
    }
}

