import { 
    Client, 
    GatewayIntentBits, 
    Message,
    PermissionsBitField, 
    } from 'discord.js';
import { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource,
    AudioPlayerStatus, 
    entersState,
    VoiceConnectionStatus,
    VoiceConnection, 
 } from '@discordjs/voice';
import { config } from './config';
import commands from './commands';
import { deployCommands } from './deploy-commands';
import ytdl from 'ytdl-core';
import ConnectionManager from './ConnectionManager';

export const connectionManagerInstance = new ConnectionManager();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildVoiceStates,
    ]});

client.once('ready', () => {
    console.log('Maestro is online!');
});

client.on("guildCreate", async (guild) => {
    await deployCommands({ guildId: guild.id });

});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) {
      return;
    }
    const { commandName } = interaction;
    if (commands[commandName as keyof typeof commands]) {
        commands[commandName as keyof typeof commands].execute(interaction);
    }
});

const voiceConnections = new Map<string, VoiceConnection>();
client.on('voiceStateUpdate', (oldState, newState) => {
    const guildId = newState.guild.id;
    const voiceConnection = voiceConnections.get(guildId);
    const voiceChannelId = voiceConnection?.joinConfig.channelId;

    if (voiceChannelId) {
        const channel = newState.guild.channels.cache.get(voiceChannelId);
        
        console.log(newState.channel?.id, voiceChannelId, channel);
        if (channel && channel.isVoiceBased()) {
            const membersInChannel = channel.members.size; 
            
            console.log(membersInChannel);
            // If the bot is the only member in the channel, disconnect
            if (membersInChannel === 1) {
                voiceConnection.destroy();
                voiceConnections.delete(guildId);
            }
        }
    }
});

const play = (message: Message) => {
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
        return message.reply("You need to be in a voice channel to play music!");
    }
    const permissions = voiceChannel.permissionsFor(message.client.user!);
    if (!permissions?.has(PermissionsBitField.Flags.Speak) || 
        !permissions.has(PermissionsBitField.Flags.Connect)){
        return message.reply("I need the permissions to join and speak in your voice channel!");
    }

    const args = message.content.split(' ');
    if (args.length < 2) {
        return message.reply("Please provide a YouTube URL.");
    }

    const stream = ytdl(args[1], { filter: 'audioonly', highWaterMark: 1 << 22});
    const resource = createAudioResource(stream);
    const player = createAudioPlayer();

    stream.once("readable",() => {
        setTimeout(()=>{ 
            player.play(resource);
        }, 500);
    });
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild!.id,
        adapterCreator: message.guild!.voiceAdapterCreator,
    });

    connection.subscribe(player);
    voiceConnections.set(message.guild!.id, connection);
    player.play(resource);
    player.pause();

    player.on(AudioPlayerStatus.Idle, () => {
    
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
            // Seems to be reconnecting to a new channel - ignore disconnect
        } catch (error) {
            // Seems to be a real disconnect which SHOULDN'T be recovered from
            connection.destroy();
            voiceConnections.delete(message.guild!.id);
        }
    });
}

client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return;
    
    if (message.content.startsWith('!ping')) {
        message.channel.send('Pong!');
    }
    if (message.content.startsWith('!play')) {
        play(message);
    }
 
    if (message.content.startsWith('!maestroupdate')) {
        await deployCommands({ guildId: message.guild!.id });
        message.channel.send('Maestro Commands Updated!');
    }
});

client.login(config.DISCORD_TOKEN);
