import { AudioPlayerStatus, createAudioPlayer, createAudioResource, StreamType, } from '@discordjs/voice';
import ytdl from 'ytdl-core';
import { Readable, Stream, Transform, TransformCallback, } from 'stream';
import { Connection } from './ConnectionManager';
import { spawn } from 'child_process';

const MB = 1024 * 1024;
class SilentStream extends Readable{
    private silenceFrame: Buffer;
    paused: boolean;
    constructor(){
        super();
        this.silenceFrame = Buffer.from(new Array(3840).fill(0)); 
        this.paused = false;
        this.on('close', () => {
            console.log(`silence closed`);
        })
    }
    _read(size: number) : void {
        if (!this.paused) {
            while (this.push(this.silenceFrame)) {
            }
        }
    }

    pause(): this {
        super.pause();
        this.paused = true;
        return this;
    }

    resume(): this {
        super.resume();
        this.paused = false;
        return this;
    }
}
class AudioBuffer{
    private buffer: Buffer;
    private maxSize: number;
    private isFull: boolean;
    private sourceStream: Readable;
    private readyToFlush: boolean;
    private isPaused: boolean;
    public done: boolean;
    private dataProcessedInSec: number;
    private lastProcessedTime: bigint | undefined; 
    private timeProcessedInSec: number;
    constructor(sourceStream:Readable, maxSize: number = MB * .5) {
        this.buffer = Buffer.alloc(0);
        this.maxSize = maxSize;
        this.isFull = false;
        this.isPaused = false;
        this.dataProcessedInSec = 0;
        this.timeProcessedInSec = 0;
        this.sourceStream = sourceStream;
        this.readyToFlush = false;
        this.done = false;
        this.sourceStream.on("end", () => {
            this.readyToFlush = true;
            this.isFull = false;
        });
    }

    append(data: Buffer) {
        this.buffer = Buffer.concat([this.buffer, data]);
        if (this.buffer.length + data.length > this.maxSize * 0.5 || this.dataProcessedInSec > this.timeProcessedInSec + 1) {
            this.isFull = true;
            this.sourceStream.pause();
        }
    }

    getChunk(size: number) : Buffer {
        console.log(`${this.buffer.length} - ${this.maxSize} | ${this.dataProcessedInSec} - ${this.timeProcessedInSec}`);
        const now = process.hrtime.bigint(); 

        if(this.isPaused) return Buffer.alloc(0)

        if(size > this.buffer.length){
            const padding = Buffer.alloc(size - this.buffer.length).fill(0);
            
            if(this.readyToFlush){
                this.append(padding);
                const flush = this.buffer.subarray(0, size);
                console.log(this.buffer.length);
                this.buffer = Buffer.alloc(0);
                this.done = true;
                return flush;
            }

        }

       

        const chunk = this.buffer.subarray(0, size);
        this.buffer = this.buffer.subarray(size);
        if (this.isFull && (this.buffer.length <= this.maxSize * 0.5 && this.dataProcessedInSec < this.timeProcessedInSec + .5 )) { // 50% threshold
            this.isFull = false;
            this.sourceStream.resume();
        }

        this.dataProcessedInSec +=  (chunk.length / (2 * 2)) / 48000;
        if(this.lastProcessedTime){
            const timeElapsed = (now - this.lastProcessedTime); 
            this.timeProcessedInSec += Number(timeElapsed) / 1_000_000_000; 
        }

        this.lastProcessedTime = now;
        return chunk;
    }
    
    setPause(pause: boolean) : boolean{
        if(this.isPaused === pause) return pause;
        console.log("pause: " + pause);
        if(pause) this.lastProcessedTime = undefined;
        else{
            this.sourceStream.resume();
            this.lastProcessedTime = process.hrtime.bigint();
        }
        return this.isPaused = pause;
    }

    getPaused(){
        return this.isPaused;
    }

    destroy(){
        this.sourceStream.destroy();
    }
}

export class AudioMixingTransform extends Transform {
    private buffers: Map<string, AudioBuffer>;
    private silentBuffer: AudioBuffer;
    private mixingInterval: number;
    public isActive = false;
    private lastTimestamp: bigint | undefined;
    private isDrained = true;
    private interval: NodeJS.Timeout;
    private sampleRate = 48000;
    private bitDepth = 16;
    private channels = 2;
    private initialDurationMs = 500; 
    private bytesPerSample = this.bitDepth / 8;
    
    constructor() {
        super();
        this.buffers = new Map<string, AudioBuffer>();
        this.mixingInterval  = 20; // milliseconds, adjust as needed
        const silentStream = new SilentStream();
        this.silentBuffer = new AudioBuffer(silentStream);
        silentStream.on('data', (chunk: Buffer) => { 
            this.silentBuffer.append(chunk);
        });
        this.on('drain', () => {
            this.isDrained = true;
            this.mixAndOutput();
        });
        this.interval = setInterval(() => {
            if (this.isDrained) {
                this.mixAndOutput();
            }
        }, this.mixingInterval);
    }
    getBufferSize() {
        if(!this.lastTimestamp){
            return this.sampleRate * this.channels * this.bytesPerSample * (this.initialDurationMs / 1000);
        }
        const now = process.hrtime.bigint();
        const elapsedTime = Number(now - this.lastTimestamp) / 1e6; // Convert to milliseconds
        this.lastTimestamp = now;


        const samples = this.sampleRate * elapsedTime / 1000;
        return samples * this.channels * this.bytesPerSample;
    }     
    alignBuffers(...buffers: Buffer[]) {
        
        // Determine the size difference
        const maxLength = Math.max(...buffers.map(buffer => buffer.length));

        // Pad all buffers to match the length of the longest buffer
        return buffers.map(buffer => {
            if (buffer.length < maxLength) {
                // Calculate the size difference and pad with silence
                const sizeDifference = maxLength - buffer.length;
                return Buffer.concat([buffer, Buffer.alloc(sizeDifference)]);
            }
            return buffer; // No padding needed if the buffer is already the longest
        });
    }

    mixAndOutput() {
        if(!this.isDrained || this.buffers.size === 0) {
            return;
        }
        const bs = this.getBufferSize()
        const pipes: Buffer[] =[];
        let anyPlaying = false;
        for(const [key, buffer] of this.buffers){
            if(!anyPlaying) anyPlaying = !buffer.getPaused();  
            const buf = buffer.getChunk(bs)!;
            if(!buf) return;
            if(buf.length> 0)
                pipes.push(buf);
            if(buffer.done)
                this.removeStream(key);

        }
        

        if(pipes.length > 0  ){
            this.silentBuffer.setPause(true);
            if(pipes.length > 1) this.alignBuffers(...pipes);
            const mix = this.mixChunk(pipes);
             this.push(mix);
        }
        else if (!anyPlaying){
            this.silentBuffer.setPause(false);
            this.push(this.silentBuffer.getChunk(bs));
        }
    }
    
    addStream(stream: Readable, identifier: string) {
        this.buffers.set(identifier, new AudioBuffer(stream));

        // Handle data from the stream
        stream.on('data', chunk => {
            if (this.buffers.has(identifier)) {
                this.buffers.get(identifier)?.append(chunk);
            }
        });
        stream.on('error', (err) => {
            console.error('Stream error:', err);
        });

        // Handle the end of the stream
        stream.on('end', () => {
            console.log('Stream ended.');
        });
    }

    canAddStreams() : boolean {
        return this.buffers.size < 4;
    }

    pauseStream(name: string){
        const buffer = this.buffers.get(name);
        if(!buffer) throw new Error("Unable to find stream.")
        buffer.setPause(true);
        this.lastTimestamp = undefined;
    }

    playStream(name:string){
        const buffer = this.buffers.get(name);
        if(!buffer) throw new Error("Unable to find stream.")
        buffer.setPause(false);
    }
    

    removeStream(name:string){
        this.buffers.delete(name);
        this.emit('streamdelete', name);
    }

    playAll(): boolean {
        for(const [key,stream] of this.buffers){
            stream.setPause(false);
        }
        return true;
    }


    pauseAll() : boolean {
        for(const [key,stream] of this.buffers){
            stream.setPause(true);
        }

        return false;
    }

    _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
        callback();
    }

    mixChunk(pipes: Buffer[]) : Buffer {
        if(pipes.length === 1) return pipes[0];
        let maxSize = pipes[0].length;
        const mixedChunk = Buffer.alloc(maxSize);
        for (let i = 0; i < maxSize; i += 2) { // Iterate by 2 bytes for 16-bit samples
            let sum = 0;
            for(let j = 0; j < pipes.length; j++) {
                const pipe = pipes[j];
                if (pipe.length > i + 1) { // Ensure we can read a full 16-bit sample
                    const sample = pipe.readInt16LE(i);
                    sum += sample;
                }
            }
            
            const mixedSample = Math.max(-32768, Math.min(32767, sum))
    
            if (i < maxSize - 1) { // Ensure we don't write beyond the buffer
                mixedChunk.writeInt16LE(mixedSample, i);
            }
        }
        return mixedChunk;
    }   

    destroy(error?: Error | undefined): this {
        clearInterval(this.interval)
        for(const [key, stream] of this.buffers){
            stream.destroy();
            this.buffers.delete(key);
        }
        if(error) console.error(error);
        super.destroy();
        return this;
    }
}

class DynamicAudioMixer {
    private streams = new Map<string, {url:string, loop: boolean }>();
    private mixer: AudioMixingTransform;
    private connection: Connection;
    constructor(connection: Connection) {
        this.connection = connection;
        this.mixer = new AudioMixingTransform();
        this.mixer.on("streamdelete", (id) => {
            const stream = this.streams.get(id);
            
            console.log("delete ",stream);
            if(stream?.loop)
                this.addStream(stream.url,id, stream.loop);

        });
        this.mixer.on('error', (error) => {
            console.error(`Error in mixer :`, error);
        });
        this.mixer.on('close', (error: any) => {
            console.error(`Close in mixer :`, error);
        });
        connection.player = createAudioPlayer();
        const resource = createAudioResource(this.mixer, { inputType: StreamType.Raw});
        connection.player.play(resource);
        connection.voiceConnection.subscribe(connection.player);
        connection.player.on(AudioPlayerStatus.Idle, () => {
            this.mixer = new AudioMixingTransform();
            const resource = createAudioResource(this.mixer, { inputType: StreamType.Raw });
            connection.player.play(resource);
        });
    }

    pauseById(id: string){
        return this.mixer.pauseStream(id);
    }

    playById(id: string){
        return this.mixer.playStream(id);
    }

    play(): boolean{
        this.mixer.playAll();
        return true;
    }

    pause() : boolean {
        this.mixer.pauseAll();
        return true;
    }

    addStream(url: string, id: string, loop: boolean = false) {
        if (this.mixer.canAddStreams()) { 

            const stream = ytdl(url, { filter:'audioonly', quality: 'highestaudio', dlChunkSize: 8000, highWaterMark: 16000 });
            
            const ffmpeg = spawn('ffmpeg', [
                '-i', 'pipe:0',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                'pipe:1',
            ]);

            stream.pipe(ffmpeg.stdin)

            this.mixer.addStream(ffmpeg.stdout, id);
            this.streams.set(id, {url: url, loop: true});
        } else {
            throw new Error('Maximum number of streams reached');
        }
    } 
    removeStream(id: string) {
        this.mixer.removeStream(id);
    }


    destroy(){
        this.mixer.destroy();
        this.connection.player.stop();
    }
        
}

export default DynamicAudioMixer;


