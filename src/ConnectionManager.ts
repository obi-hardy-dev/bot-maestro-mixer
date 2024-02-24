import { AudioPlayer, VoiceConnection, VoiceConnectionStatus, createAudioPlayer, entersState, joinVoiceChannel } from "@discordjs/voice"
import { Guild, GuildForumThreadManager, VoiceBasedChannel } from "discord.js";
import DynamicAudioMixer from "./AudioMixer";
import MusicPlayer from "./MusicPlayer";
import SoundEffectManager from "./SoundEffectManager";

export type Connection = {
    voiceConnection: VoiceConnection | undefined,
    guild: Guild,
    musicPlayer: MusicPlayer,
    effectPlayer: SoundEffectManager,
    mixer: DynamicAudioMixer | undefined;
}

class ConnectionManager {
    voiceConnections: Map<string, Connection>;
    
    constructor(){
        this.voiceConnections = new Map<string, Connection>();
    }
    
    getGuild(guild: Guild) : Connection {
        let connection = this.voiceConnections.get(guild.id);
        if(!connection){
            console.log(`connection create`);
            connection = { 
                guild: guild,
                musicPlayer: new MusicPlayer(guild),
                effectPlayer: new SoundEffectManager(guild),
            } as Connection;

            connection.mixer = new DynamicAudioMixer(connection);
            this.voiceConnections.set(guild.id, connection);
        }
        return connection;
    }

    connect(guild: Guild, voiceChannel: VoiceBasedChannel) : Connection{
        let connection = this.voiceConnections.get(guild.id);
        if(!connection){
            connection = this.getGuild(guild);
        }
        if(!connection?.voiceConnection){
            console.log(`connection create`);
            const voiceConnection = this.createConnection(voiceChannel);
            voiceConnection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
                try {
                    await Promise.race([
                        entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                    // Seems to be reconnecting to a new channel - ignore disconnect
                } catch (error) {
                    // Seems to be a real disconnect which SHOULDN'T be recovered from
                    console.log(`disconnected from ${guild.id} `);
                    connection?.mixer?.destroy();
                    this.disconnect(guild.id);
                }
            });
            connection.voiceConnection = voiceConnection;
            connection.mixer = new DynamicAudioMixer(connection);
            connection.mixer.on('song-done', () => {
                if(connection?.musicPlayer.loop)
                    connection?.musicPlayer.play(connection);
                else 
                    connection?.musicPlayer.next(connection);
            })
        }

        return connection;
    }

    disconnect(id: string) {
        const connection = this.voiceConnections.get(id);
    
        if(!connection?.voiceConnection) throw new Error("No connection to disconnect");

        connection.voiceConnection = undefined;
        connection.mixer = undefined;
    }
    
    createConnection(voiceChannel: VoiceBasedChannel) : VoiceConnection {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel!.guild!.voiceAdapterCreator,
        });

        // Add new 'Disconnected' listener
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection!, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection!, VoiceConnectionStatus.Connecting, 5_000),
                ]);
                // Connection is reconnecting
            } catch (error) {
                // Connection has fully disconnected
                connection.destroy();
            }
        });
        return connection;
    }

    getConnection(id: string) : Connection {
        const connection = this.voiceConnections.get(id);
    
        if(!connection) throw new Error("No connection for server");
        
        return connection;
    }


}

export default ConnectionManager
