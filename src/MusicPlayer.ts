import ytdl from "@distube/ytdl-core";
import DynamicAudioMixer from "./AudioMixer";
import { Track } from "./Track";
import fs from "fs";

export enum MusicType {
    YouTube,
}

export class MusicPlayer {
    guildId: string;
    tracks: Track[];
    player: DynamicAudioMixer | undefined;
    isPlaying: boolean;
    currentTrack: number;
    playingId: string | undefined;
    loop: boolean;
    length: number;


    constructor(guildId: string) {
        this.guildId = guildId;
        this.tracks = [];
        this.currentTrack = -1;
        this.length = 0;
        this.loop = false;
        this.isPlaying = false;
    }

    remove(trackNum?: number): void {
        if (!trackNum) trackNum = this.currentTrack;
        this.tracks.splice(trackNum, 1);
    }

    private setInfoFromUrl(url: string, callback: (title: string) => void): void {
        try {
            ytdl.getBasicInfo(url).then(info => {
                callback(info.videoDetails.title);
            });
        } catch (err) {
            console.error("Error fetching video info:", err);
            callback("Unknown");
        }
    }

    add(track: Track): void {
        this.length++;

        if (!track.name && track.url) this.setInfoFromUrl(track.url, (title) => { track.trackName = title });

        this.tracks.push(track);

    }

    currentlyPlaying(): string {
        const curTrack = this.tracks[this.currentTrack];
        if (!curTrack) return "No currently playing track";

        return `${this.currentTrack + 1}: ${curTrack.trackName} - ${curTrack.url}`;
    }

    list(): string[] {
        return this.tracks
            .map((track: Track, i: number) => {
                return `${i + 1}: ${track.trackName} ${i === this.currentTrack ? 'Playing' : ''}`
            });
    }

    togglePause(): boolean {
        if (!this.player) throw Error("Music Player | Unable to pause, no player created");
        if (this.isPlaying) {
            this.isPlaying = this.player!.pauseById(this.playingId!);
        }
        else {
            this.isPlaying = this.player.playById(this.playingId!);
        }
        return this.isPlaying;
    }

    playFromUrl(url: string): void {
        this.playingId = "urltrack";
        this.player?.addStream(url, "urltrack")
        this.isPlaying = true;
    }

    play(trackNum?: number): void {
        if (trackNum && (trackNum < 0 || trackNum > this.length)) throw Error("Music Player | Track number was not found.");

        console.log(trackNum)
        if (trackNum && trackNum >= 0) this.currentTrack = trackNum;

        if (this.currentTrack < 0) return this.prev();

        console.log("play: " + this.currentTrack);

        const track = this.tracks[this.currentTrack];
        if (!track) throw Error("Music Player | No track found");
        if (this.playingId) this.player?.removeStream(this.playingId);
        this.player!.addStream(track.url, "track" + track.url)
        this.playingId = "track" + track.url;
        this.isPlaying = true;
    }

    stop() {
        if (this.playingId) this.player?.stopById(this.playingId);
        this.playingId = undefined;
    }

    next(): void {
        const track = this.tracks[this.currentTrack];
        if (track)
            this.player?.removeStream("track" + track.url);
        console.log(this.currentTrack);
        this.currentTrack++;
        if (this.currentTrack >= this.tracks.length) this.currentTrack = 0;

        this.play(this.currentTrack);
    }

    prev(): void {
        const track = this.tracks[this.currentTrack];
        if (track)
            this.player?.removeStream("track" + track.url);
        this.currentTrack--;
        if (this.currentTrack < 0) {
            this.currentTrack = 0;
        }

        this.play(this.currentTrack);
    }

    clear() {
        this.playingId = undefined;
        this.tracks = [];
        this.currentTrack = -1;
        this.length = 0;
        this.loop = false;
        this.isPlaying = false;
    }


    async save(): Promise<void> {
        const savePath = `./musicplayer/${this.guildId}-save.json`;

        const savedState = {
            currentTrack: this.currentTrack,
            loop: this.loop,
            length: this.length,
            tracks: this.tracks.map(({ name, url, trackName }) => ({ name, url, trackName, isPlaying: false })),
            guildId: this.guildId,
        };

        await fs.promises.writeFile(savePath, JSON.stringify(savedState));
    }

    async load(): Promise<void> {
        const savePath = `./musicplayer/${this.guildId}-save.json`;

        const savedState = JSON.parse(await fs.promises.readFile(savePath, 'utf8'));

        this.currentTrack = savedState.currentTrack;
        this.loop = savedState.loop;
        this.length = savedState.length;
        this.tracks = savedState.tracks;
        this.guildId = savedState.guildId;
    }
}

export default MusicPlayer
