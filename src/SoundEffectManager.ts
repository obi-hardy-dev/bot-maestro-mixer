import DynamicAudioMixer from "./AudioMixer";

type SoundEffect = {
    name: string, 
    url: string,
    loop: boolean,
    isPlaying: boolean,
}

class SoundEffectManager {
    effects: SoundEffect[];
    player: DynamicAudioMixer | undefined;

    constructor(){
        this.effects = [];
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
        return this.effects.find((e) => e.name === name && e.isPlaying) !== undefined; 
    }

    list() : string[] {
        return this.effects.map((e, i) => 
            `${i+1}: ${e.name} - ${e.url} ${e.isPlaying && 'is playing'} ${e.loop && 'will loop'}`)
    }

    playFromUrl(url: string, loop: boolean = false) : void {        
        const effect = { url: url, loop: loop } as SoundEffect; 
        this.player!.addStream(effect.url, "effect" + effect.name, loop)
    }

    play(name: string) : void {
        const effect = this.effects.filter((effect) => effect.name === name)[0];
        if(!effect) throw new Error('Effect not found');
        effect.isPlaying = true;
        this.player!.addStream(effect.url, "effect" + effect.name, effect.loop)
        
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
            this.player!.stopById("effect"+name);
            se.isPlaying = false;
        }
    }
    togglePause(name: string) : boolean{
        if(!this.player) throw Error("Effect Manager | Unable to pause, no player created");
        
        const se = this.effects.filter((effect) => effect.name == name)[0];

        if(se.isPlaying){
            se.isPlaying = this.player!.pauseById("effect"+name);
        }
        else{
            se.isPlaying = this.player.playById("effect"+name);
        }
        return se.isPlaying;
    }

}

export default SoundEffectManager;
