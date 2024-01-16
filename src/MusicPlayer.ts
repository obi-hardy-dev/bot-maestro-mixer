import { CommandInteraction, Guild, } from "discord.js";
import ytdl from "ytdl-core";
import { globalEmitter } from './EventEmitter';
import { Connection } from "./ConnectionManager";
import DynamicAudioMixer from "./AudioMixer";

type Track = {
    trackName: string | undefined,
    url: string ,
    volume: number | undefined,
}

export enum MusicType {
    YouTube,
}

export class MusicPlayer {
    tracks: Track[];
    player: DynamicAudioMixer | undefined;
    isPlaying: boolean;
    currentTrack: number;
    playingId: string | undefined;
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
                return `${i+1}: ${track.trackName} ${i === this.currentTrack ? 'Playing' : ''}`
            });
    }

    togglePause(connection: Connection) : boolean {
        this.player = connection.mixer;
        if(!this.player) throw Error("Music Player | Unable to pause, no player created");
        
        if(this.isPlaying){
            this.isPlaying = this.player!.pauseById(this.playingId!) ? false : true;
        }
        else{
            this.isPlaying = this.player.playById(this.playingId!) ? true : false;this.playingId
        }
        return this.isPlaying;
    }

    playFromUrl(connection: Connection, url: string) : void {        

        this.currentUrl = url; 


        this.playingId = "urltrack";
        connection.mixer?.addStream(url, "urltrack")
        this.isPlaying = true;
    }

    play(connection: Connection, trackNum?: number) : void {
        if(trackNum && (trackNum < 0 || trackNum > this.length)) throw Error("Music Player | Track number was not found.");
        
        if(trackNum) this.currentTrack = trackNum;

        if(this.currentTrack < 0) return this.prev(connection); 

        console.log("play: " + this.currentTrack); 
        
        const track = this.tracks[this.currentTrack];

        
        connection.mixer?.addStream(track.url, "track" + track.trackName)

        this.isPlaying = true;
    }
    
    next(connection: Connection): void {
        console.log("next called");
        const track = this.tracks[this.currentTrack];
        connection.mixer?.removeStream("track"+track.trackName);
        this.currentTrack++;
        if(this.currentTrack >= this.tracks.length) this.currentTrack = this.tracks.length-1;

        this.play(connection,this.currentTrack);
    }   

    prev(connection: Connection) : void {
        this.currentTrack--;
        if(this.currentTrack < 0) {
            this.currentTrack = 0;
        }
        
        this.play(connection, this.currentTrack);
    }

}

export default MusicPlayer
