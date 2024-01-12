import { AudioPlayer, AudioPlayerStatus, AudioResource, VoiceConnection, createAudioPlayer, createAudioResource } from "@discordjs/voice";
import { BaseGuildVoiceChannel, Channel, Guild, VoiceBasedChannel, VoiceChannel } from "discord.js";
import ytdl from "ytdl-core";
import {globalEmitter} from './EventEmitter' 
import { Connection } from "./ConnectionManager";
import { connect } from "http2";

enum UrlType {
    YouTube
}
type SoundEffect = {
    name: string, 
    url: string,
    loop: boolean,
    isPlaying: boolean,
    player: AudioPlayer | undefined,
}

class SoundEffectManager {
    guild: Guild;
    effects: SoundEffect[];
    currentlyPlaying: SoundEffect[];
    

    constructor(guild: Guild){
        this.guild = guild;
        this.effects = [];
        this.currentlyPlaying = [];
        globalEmitter.on('voiceConnectionDestroyed', (guildId: string) => {
            if(this.guild!.id === guildId){
                this.currentlyPlaying.forEach(se => {
                    se.player?.pause();
                });
                this.currentlyPlaying.splice(0,this.currentlyPlaying.length);
            }
        });
    }

    add(url: string, name: string, loop: boolean = false){
        
        const soundEffect = { url: url, name: name, loop: loop } as SoundEffect;

        this.effects.push(soundEffect);
    }

    remove(name: string) : SoundEffect[] {
        const idx = this.effects.findIndex((effect) => effect.name == name);
        return this.effects.splice(idx,1);
    }

    isCurrentlyPlaying(name: string) : boolean {
        return this.currentlyPlaying.find((e) => e.name === name) !== undefined; 
    }

    list() : string[] {
        return this.effects.map((e, i) => 
            `${i+1}: ${e.name} - ${e.url} ${this.isCurrentlyPlaying(e.name) && 'Playing '}${e.loop && 'Loop'}`)
    }

    private makeResource(effect: SoundEffect, type: UrlType) : AudioResource | null{
        let resource: AudioResource | null = null;
        switch (type) {
            case UrlType.YouTube:
                const stream = ytdl(effect.url, { filter: 'audioonly', highWaterMark: 1 << 22});
                resource = createAudioResource(stream);
                stream.once("readable",() => {
                    setTimeout(()=>{ 
                        effect.player!.play(resource!);
                    }, 500);
                });
                break;
        }

        return resource;
    }

    playFromUrl(connection: Connection, url: string, loop: boolean = true) : void {        
        const vc = connection.voiceConnection;
        const effect = { url: url, loop: loop } as SoundEffect; 
        connection.mixer!.addStream(effect.url, "effect" + effect.name, loop)
    }
    play(connection: Connection, name: string) : void {
        const vc = connection.voiceConnection;
        const effect = this.effects.filter((effect) => effect.name === name)[0];
        if(!effect) throw new Error('Effect not found');
        
        if(!vc){
            throw Error("Effect Manager | No Voice Connection");
        }

        
        connection.mixer!.addStream(effect.url, "effect" + effect.name, effect.loop)
       /* const resource = this.makeResource(effect, UrlType.YouTube);
        if(!resource) throw Error("Effect Manager | Resource was not found");
*/
        
    }

    toggleLoop(name: string) : boolean{
        const se = this.effects.filter((effect) => effect.name == name)[0];
        if(!se) throw Error("Effect Manager | Effect not found");
        
        se.loop = !se.loop;
        return se.loop;
    }

    togglePause(name: string) : boolean{
        const se = this.currentlyPlaying.filter((effect) => effect.name == name)[0];
        if(!se.player) throw Error("Effect Manager | Unable to pause, no player created");
        
        if(se.isPlaying){
            se.isPlaying = se.player!.pause(true) ? false : true;
        }
        else{
            se.isPlaying = se.player.unpause() ? true : false;
        }
        return se.isPlaying;
    }

}

export default SoundEffectManager;
