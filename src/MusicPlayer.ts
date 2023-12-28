import { AudioPlayer, 
    AudioPlayerStatus,
    AudioResource,
    VoiceConnection,
    createAudioPlayer,
    createAudioResource} from "@discordjs/voice";
import { CommandInteraction, Guild, } from "discord.js";
import ytdl from "ytdl-core";
import { globalEmitter } from './EventEmitter';

type Track = {
    trackName: string | undefined,
    url: string | undefined,
    volume: number | undefined,
}

export enum MusicType {
    YouTube,
}

export class MusicPlayer {
    tracks: Track[];
    player: AudioPlayer | undefined;
    isPlaying: boolean;
    currentTrack: number;
    guild: Guild;
    loop: boolean;
    length: number;
    currentUrl: string | undefined;


    constructor(guild: Guild){
        this.tracks = [];
        this.currentTrack = -1;
        this.length = 0;
        this.loop = false;
        this.isPlaying = false;
        this.guild = guild; 
        this.player = undefined;
        globalEmitter.on('voiceConnectionDestroyed', (guildId: string) => {
            // Handle the disconnection logic
            if(this.guild!.id == guildId){
                this.currentTrack = -1;
            }
        });

    }

    private makeResource(url: string, type: MusicType) : AudioResource | null{
        let resource: AudioResource | null = null;
        switch (type) {
            case MusicType.YouTube:
                const stream = ytdl(url, { filter: 'audioonly', highWaterMark: 1 << 22});
                resource = createAudioResource(stream);
                stream.once("readable",() => {
                    setTimeout(()=>{ 
                        this.player!.play(resource!);
                    }, 500);
                });
                break;
        }

        return resource;
    }

    private getOptionValue<T>(interaction: CommandInteraction, name: string) : T | undefined{
        const option = interaction.options.get(name);

        return option ? option.value as T : undefined;
    }

    remove (trackNum?: number) : void {
        if(!trackNum) trackNum = this.currentTrack;
    
        this.tracks.splice(trackNum, 1);
    }

    private setInfoFromUrl(url: string, callback: (title: string) => void): void {
        try{
            ytdl.getBasicInfo(url).then(info => {
                callback(info.videoDetails.title);
            });
        } catch (err) {
            console.error("Error fetching video info:", err);
            callback("Unknown");
        }
    }

    add(interaction: CommandInteraction) : void {
        this.length++;
        
        const trackName: string | undefined = this.getOptionValue<string>(interaction, 'name');
        const trackNum: number | undefined = this.getOptionValue<number>(interaction, 'num');
        const volume: number | undefined = this.getOptionValue<number>(interaction, 'volume');
        const songUrl: string | undefined = this.getOptionValue<string>(interaction, 'url');
        

        const newTrack = { url: songUrl, trackName: trackName, volume: volume } as Track;

        if(!trackName && songUrl) this.setInfoFromUrl(songUrl, (title) => { newTrack.trackName = title }); 

        if(trackNum && trackNum >= 0) console.log(`TODO: trackNum ${trackNum} doesnt exist yet`);   

        this.tracks.push(newTrack); 

    }
    
    currentlyPlaying() : string {
        const curTrack = this.tracks[this.currentTrack];
        if(!curTrack) return "No currently playing track";

        return `${this.currentTrack + 1}: ${curTrack.trackName} - ${curTrack.url}`; 
    }

    list() : string[] {
        return this.tracks
            .map((track: Track, i: number) => { 
                return `${i}: ${track.trackName} ${i === this.currentTrack ? 'Playing' : ''}`
            });
    }

    togglePause() : boolean {
        if(!this.player) throw Error("Music Player | Unable to pause, no player created");
        
        if(this.isPlaying){
            this.isPlaying = this.player!.pause(true) ? false : true;
        }
        else{
            this.isPlaying = this.player.unpause() ? true : false;
        }
        return this.isPlaying;
    }

    playFromUrl(vc: VoiceConnection, url: string) : void {        

        this.currentUrl = url; 

        if(!this.player) {
            this.player = createAudioPlayer();
            this.player.on(AudioPlayerStatus.Idle, () => {
                if(this.loop){
                    if(this.currentUrl) this.playFromUrl(vc, this.currentUrl);
                    else this.play(vc);
                }else{
                    this.next(vc);
                }
            });
        }

        const resource = this.makeResource(url as string, MusicType.YouTube);
        if(!resource) throw Error("Music Player | Resource was not found");
        
        if(!vc){
            throw Error("Music Player | No Voice Connection");
        }
        vc.subscribe(this.player);
        this.currentUrl = url;
        this.player.play(resource);   
        this.isPlaying = true;
    }

    play(vc: VoiceConnection, trackNum?: number) : void {
        if(trackNum && (trackNum < 0 || trackNum > this.length)) throw Error("Music Player | Track number was not found.");
        
        if(trackNum) this.currentTrack = trackNum;

        if(this.currentTrack < 0) return this.prev(vc); 

        console.log("play: " + this.currentTrack); 
        
        const track = this.tracks[this.currentTrack];

        if(!this.player) {
            this.player = createAudioPlayer();
            this.player.on(AudioPlayerStatus.Idle, () => {
                if(this.loop){
                    if(this.currentUrl) this.playFromUrl(vc, this.currentUrl);
                    else this.play(vc);
                }else{
                    this.next(vc);
                }
            });
        }

        const resource = this.makeResource(track!.url as string, MusicType.YouTube);
        if(!resource) throw Error("Music Player | Resource was not found");

        if(!vc){
            throw Error("Music Player | No Voice Connection");
        }

        vc.subscribe(this.player);

        this.player.play(resource);
        this.isPlaying = true;
    }
    
    next(vc: VoiceConnection): void {
        this.currentTrack++;
        if(this.currentTrack >= this.tracks.length) this.currentTrack = this.tracks.length-1;

        this.play(vc,this.currentTrack);
    }   

    prev(vc: VoiceConnection) : void {
        this.currentTrack--;
        if(this.currentTrack < 0) {
            this.currentTrack = 0;
        }
        
        this.play(vc, this.currentTrack);
    }

    /*join(voiceChannel?: VoiceBasedChannel) : void {

        if(!voiceChannel){
            voiceChannel = this.channel;
        }

        this.channel = voiceChannel;

        if(!this.channel) throw Error("Missing channel, cannot join.")

        const connection = joinVoiceChannel({
            channelId: this.channel!.id,
            guildId: this.guild.id,
            adapterCreator: this.channel!.guild!.voiceAdapterCreator,
        });
        this.voiceConnection = connection;

        if (this.voiceConnection) {
            this.voiceConnection.off(VoiceConnectionStatus.Disconnected, this.onVoiceConnectionDisconnect.bind(this));
        }

        // Add new 'Disconnected' listener
        this.voiceConnection.on(VoiceConnectionStatus.Disconnected, this.onVoiceConnectionDisconnect.bind(this));
    }

    private async onVoiceConnectionDisconnect() {
        try {
            await Promise.race([
                entersState(this.voiceConnection!, VoiceConnectionStatus.Signalling, 5_000),
                entersState(this.voiceConnection!, VoiceConnectionStatus.Connecting, 5_000),
            ]);
            // Connection is reconnecting
        } catch (error) {
            // Connection has fully disconnected
            this.voiceConnection?.destroy();
        }
    }

    leave() : void {
        this.isPlaying = false;
        if(this.player) {
            this.player.pause();
        }
        if(this.channel){
            this.channel = undefined;
        }
        if(this.voiceConnection){
            this.voiceConnection?.destroy();
            this.voiceConnection = undefined;
        }
    }
    */
}


export default MusicPlayer
