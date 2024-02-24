import {globalEmitter} from './EventEmitter' 
import { Connection } from "./ConnectionManager";
import DynamicAudioMixer from "./AudioMixer";
import { Guild } from 'discord.js';

enum UrlType {
    YouTube
}
type SoundEffect = {
    name: string, 
    url: string,
    loop: boolean,
    isPlaying: boolean,
    player: DynamicAudioMixer | undefined,
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
    playFromUrl(connection: Connection, url: string, loop: boolean = false) : void {        
        const vc = connection.voiceConnection;
        if(!vc){
            throw Error("Effect Manager | No Voice Connection");
        }
        const effect = { url: url, loop: loop } as SoundEffect; 
        connection.mixer!.addStream(effect.url, "effect" + effect.name, loop)
    }
    play(connection: Connection, name: string) : void {
        const vc = connection.voiceConnection;
        if(!vc){
            throw Error("Effect Manager | No Voice Connection");
        }
        const effect = this.effects.filter((effect) => effect.name === name)[0];
        if(!effect) throw new Error('Effect not found');
        effect.isPlaying = true;
        effect.player = connection.mixer;
        connection.mixer!.addStream(effect.url, "effect" + effect.name, effect.loop)
        
    }

    toggleLoop(name: string) : boolean{
        const se = this.effects.filter((effect) => effect.name == name)[0];
        if(!se) throw Error("Effect Manager | Effect not found");
        
        se.loop = !se.loop;
        return se.loop;
    }

    stop(name: string) {
        const se = this.effects.filter((effect) => effect.name == name)[0];
        console.log(se);
        if(se?.isPlaying){
            console.log("stopping: " + name);
            se.player!.stopById("effect"+name);
        }
    }
    togglePause(name: string) : boolean{
        const se = this.effects.filter((effect) => effect.name == name)[0];
        if(!se.player) throw Error("Effect Manager | Unable to pause, no player created");
        
        if(se.isPlaying){
            se.isPlaying = se.player!.pauseById("effect"+name);
        }
        else{
            se.isPlaying = se.player.playById("effect"+name);
        }
        return se.isPlaying;
    }

}

export default SoundEffectManager;
