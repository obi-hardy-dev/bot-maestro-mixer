import { AudioPlayer, VoiceConnection, VoiceConnectionStatus, createAudioPlayer, entersState, joinVoiceChannel } from "@discordjs/voice"
import { Guild, VoiceBasedChannel } from "discord.js";
import { globalEmitter } from './EventEmitter';
import DynamicAudioMixer from "./AudioMixer";

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
        connection.voiceConnection.destroy();

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
