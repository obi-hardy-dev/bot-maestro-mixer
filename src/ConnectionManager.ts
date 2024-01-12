import { AudioPlayer, VoiceConnection, VoiceConnectionStatus, createAudioPlayer, entersState, joinVoiceChannel } from "@discordjs/voice"
import { Guild, VoiceBasedChannel } from "discord.js";
import { globalEmitter } from './EventEmitter';
import DynamicAudioMixer from "./AudioMixer";
import { disconnect } from "process";

export type Connection = {
    voiceConnection: VoiceConnection,
    guild: Guild,
    player: AudioPlayer,
    mixer: DynamicAudioMixer | undefined;
}

class ConnectionManager {
    voiceConnections: Map<string, Connection>;
    
    constructor(){
        this.voiceConnections = new Map<string, Connection>();
    }
    

    connect(guild: Guild, voiceChannel: VoiceBasedChannel) : Connection{
        let connection = this.voiceConnections.get(guild.id);
        if(!connection){
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
            connection = { 
                voiceConnection: voiceConnection,
                guild: guild,
                player: createAudioPlayer(),
            } as Connection;

            connection.mixer = new DynamicAudioMixer(connection);
            this.voiceConnections.set(guild.id, connection);
        }

        return connection;
    }

    disconnect(id: string) {
        const connection = this.voiceConnections.get(id);
    
        if(!connection) throw new Error("No connection to disconnect");

        globalEmitter.emit('voiceConnectionDisconnected', id);

        this.voiceConnections.delete(id);
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
                globalEmitter.emit('voiceConnectionDisconnected', voiceChannel.guildId);
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
