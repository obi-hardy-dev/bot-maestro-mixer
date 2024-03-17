import DynamicAudioMixer from "./AudioMixer";
import fs from "fs";

type SoundEffect = {
    name: string, 
    url: string,
    loop: boolean,
    isPlaying: boolean,
}

class SoundEffectManager {
    guildId: string;
    effects: SoundEffect[];
    player: DynamicAudioMixer | undefined;

    constructor(guildId: string){
        this.guildId = guildId;
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

    //Testing STATE SAVE AND LOAD


// Save the current state to a JSON file
  async save(): Promise<void> {
    // Get the directory path for the guild's save file
    const savePath = `./semanager/${this.guildId}-save.json`;

    // Create an object to save, excluding the transient properties 'loop' and 'isPlaying'
    const savedState = {
      effects: this.effects.map(({ name, url, loop }) => ({ name, url, loop, isPlaying: false })),
      guildId: this.guildId,
    };

    // Write the JSON string to the save file
    await fs.promises.writeFile(savePath, JSON.stringify(savedState));
  }

  // Load the state from a JSON file
  async load(): Promise<void> {
    // Get the directory path for the guild's save file
    const savePath = `./semanager/${this.guildId}-save.json`;

    // Read the JSON string from the file
    const savedState = JSON.parse(await fs.promises.readFile(savePath, 'utf8'));

    // Override the current state with the saved state
    this.effects = savedState.effects;
    this.guildId = savedState.guildId;
  }
}

export default SoundEffectManager;
