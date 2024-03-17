import { 
    Client, 
    GatewayIntentBits, 
    Interaction, 
    Message,
    } from 'discord.js';
import { 
    VoiceConnection, 
 } from '@discordjs/voice';
import { config } from './config';
import commands from './commands';
import { deployCommands } from './deploy-commands';
import ConnectionManager from './ConnectionManager';
import { getConnection } from "./utils/Interaction";
import { Connection } from "./ConnectionManager";

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


client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isButton()) return;

    console.log("hit");
    const customId = interaction.customId;
    const guild = interaction.guild;
    if (!guild) return;

    // Example logic for handling a button press
    try {
        const connection: Connection = getConnection(interaction);

        const mplayer = connection.musicPlayer;
        switch (customId) {
            case 'play':
            // Invoke play logic here
                mplayer.play();
                await interaction.reply({ content: 'Play button pressed', ephemeral: true });
                break;
            case 'pause':
                // Invoke pause/togglepause logic here
                mplayer.togglePause();
                await interaction.reply({ content: 'Pause/Play button pressed', ephemeral: true });
                break;
            case 'prev':
                // Invoke skip logic here
                mplayer.prev();
                await interaction.reply({ content: 'Skip button pressed', ephemeral: true });
                break;
            case 'next':
                // Invoke skip logic here
                mplayer.next();
                await interaction.reply({ content: 'Skip button pressed', ephemeral: true });
                break;
            case 'stop':
                // Invoke stop logic here
                mplayer.stop();
                await interaction.reply({ content: 'Stop button pressed', ephemeral: true });
                break;
                // Handle other cases as needed
        }
    } catch (error) {
        let errorMsg = "Error occurred.";
        if (error instanceof Error) {
            errorMsg = error.message;
        }
        await interaction.reply({ content: errorMsg, ephemeral: true });
    }
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

client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return;
    
    if (message.content.startsWith('!ping')) {
        message.channel.send('Pong!');
    }
 
    if (message.content.startsWith('!maestroupdate')) {
        await deployCommands({ guildId: message.guild!.id });
        message.channel.send('Maestro Commands Updated!');
    }
});

client.login(config.DISCORD_TOKEN);
