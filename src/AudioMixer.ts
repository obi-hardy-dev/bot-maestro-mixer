import { AudioPlayerStatus, createAudioPlayer, createAudioResource, StreamType, } from '@discordjs/voice';
import ytdl from 'ytdl-core';
import { Readable, Stream, Transform, TransformCallback, } from 'stream';
import { Connection } from './ConnectionManager';
import { spawn } from 'child_process';

const MB = 1024 * 1024;
class AudioBuffer{
    private buffer: Buffer;
    private maxSize: number;
    private isFull: boolean;
    private sourceStream: Readable;
    private readyToFlush: boolean;
    private isPaused: boolean;
    public done: boolean;
    private dataSentInSec: number;
    private lastProcessedTime: bigint | undefined; 
    private timeProcessedInSec: number;

    constructor(sourceStream:Readable, maxSize: number = MB * 10) {
        this.buffer = Buffer.alloc(0);
        this.maxSize = maxSize;
        this.isFull = false;
        this.isPaused = false;
        this.dataSentInSec = 0;
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
        if (this.buffer.length + data.length > this.maxSize * 0.5 || this.dataSentInSec > this.timeProcessedInSec + 1) {
            this.isFull = true;
            this.sourceStream.pause();
        }
    }

    getChunk(size: number) : Buffer | undefined{
        //console.log(`${size} :  ${this.buffer.length} / ${this.maxSize} | ${this.dataSentInSec} - ${this.timeProcessedInSec}`);
        if(this.isPaused) return undefined;
        const now = process.hrtime.bigint(); 


        if(size > this.buffer.length){
            if(this.readyToFlush){
                const flush = this.buffer.subarray(0, size);
                console.log(this.buffer.length);
                this.buffer = Buffer.alloc(0);
                this.done = true;
                return flush;
            }

        }

       

        const chunk = this.buffer.subarray(0, size);
        this.buffer = this.buffer.subarray(size);
        if (this.isFull && (this.buffer.length <= this.maxSize * 0.5 && this.dataSentInSec < this.timeProcessedInSec + .5 )) { // 50% threshold
            this.isFull = false;
            this.sourceStream.resume();
        }

        this.dataSentInSec +=  (chunk.length / (2 * 2)) / 48000;
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
        if(pause) {
            this.lastProcessedTime = process.hrtime.bigint();
        }
        else{
            const now = process.hrtime.bigint();
            if(this.lastProcessedTime)
                console.log(`pause length: ${this.getTimeElapsedInSec(this.lastProcessedTime, now)}`);
            this.sourceStream.resume();
            this.lastProcessedTime = now;
        }
        return this.isPaused = pause;
    }
    
    getTimeElapsedInSec(then: bigint, now: bigint ): number {
        const timeElapsed = (now - then); 
        return Number(timeElapsed) / 1_000_000_000; 
    }

    getPaused(){
        return this.isPaused;
    }

    destroy(){
        this.setPause(true);
        this.buffer = Buffer.alloc(0);
        this.sourceStream.destroy();
    }
}

export class AudioMixingTransform extends Transform {
    private buffers: Map<string, AudioBuffer>;
    private mixingInterval: number;
    public isActive = false;
    private lastTimestamp: bigint | undefined;
    private interval: NodeJS.Timeout;
    private sampleRate = 48000;
    private bitDepth = 16;
    private channels = 2;
    private initialDurationMs = 500; 
    private bytesPerSample = this.bitDepth / 8;
    
    constructor() {
        super();
        this.buffers = new Map<string, AudioBuffer>();
        this.mixingInterval  = 10; // milliseconds, adjust as needed
        this.interval = setInterval(() => {
            this.mixAndOutput();
        }, this.mixingInterval);
    }
    getBufferSize() {
        const now = process.hrtime.bigint();
        if(!this.lastTimestamp){
            this.lastTimestamp = now;
            return this.sampleRate * this.channels * this.bytesPerSample * (this.initialDurationMs / 1000);
        }
        const elapsedTime = Number(now - this.lastTimestamp) / 1e6; // Convert to milliseconds

        this.lastTimestamp = now;

        const samples = this.sampleRate * elapsedTime / 1000;
        let bufferSize = samples * this.channels * this.bytesPerSample;
        bufferSize = bufferSize - (bufferSize % 2);
        return bufferSize;
    }     
    alignBuffers(...buffers: Buffer[]) {
        
        // Determine the size difference
        const maxLength = Math.max(...buffers.map(buffer => buffer.length));

        // Pad all buffers to match the length of the longest buffer
        return buffers.map(buffer => {
            if (buffer.length < maxLength) {
                console.log("padded");
                // Calculate the size difference and pad with silence
                const sizeDifference = maxLength - buffer.length;
                return Buffer.concat([buffer, Buffer.alloc(sizeDifference).fill(0)]);
            }
            return buffer; // No padding needed if the buffer is already the longest
        });
    }

    mixAndOutput() {
    
        const bs = this.getBufferSize()
        const pipes: Buffer[] =[];
        for(const [key, buffer] of this.buffers){
            const buf = buffer.getChunk(bs);
            if(!buf) continue;
            if(buf.length> 0)
                pipes.push(buf);
            if(buffer.done)
                this.removeStream(key);

        }
        

        if(pipes.length > 0  ){
            const mix = this.mixChunk(pipes);
            this.push(mix);
        }
        else{
            this.push(Buffer.alloc(bs).fill(0))
        }
    }
    
    addStream(stream: Readable, identifier: string) {
        this.buffers.set(identifier, new AudioBuffer(stream));

        stream.on('data', chunk => {
            if (this.buffers.has(identifier)) {
                this.buffers.get(identifier)?.append(chunk);
            }
        });
        stream.on('error', (err) => {
            console.error('Stream error:', err);
        });

        stream.on('end', () => {
            console.log('Stream ended.');
        });
    }

    canAddStreams() : boolean {
        return this.buffers.size < 5;
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
        console.log(`removing in transform mixer ` + name);
        this.buffers.get(name)?.destroy();
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
        const maxSize = Math.max(...pipes.map(m => m.length));
        const mixedChunk = Buffer.alloc(maxSize);
        for (let i = 0; i < maxSize-1; i += 2) { // Iterate by 2 bytes for 16-bit samples
            let sum = 0;
            for(let j = 0; j < pipes.length; j++) {
                const pipe = pipes[j];
                if(i + 1 < pipe.length){  
                    const sample = pipe.readInt16LE(i);
                    sum += sample;
                }
            }
            let mixedSample = sum; // Ensure floating-point division
            mixedSample = Math.trunc(Math.max(-32768, Math.min(32767, mixedSample))); // Clamping and rounding
    
            mixedChunk.writeInt16LE(mixedSample, i);
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
            this.streams.delete(id);
            if(stream?.loop)
                this.addStream(stream.url,id, stream.loop);
        
        });
        this.mixer.on('error', (error) => {
            console.error(`Error in mixer :`, error);
        });
        this.mixer.on('close', () => {
            console.error(`Close in mixer :`);
        });
        connection.player = createAudioPlayer();
        const resource = createAudioResource(this.mixer, { inputType: StreamType.Raw});
        connection.player.play(resource);
        connection.voiceConnection.subscribe(connection.player);
        connection.voiceConnection.on('error', (error) => {
            console.error(`Voice connection errror`, error);
        });
        connection.player.on(AudioPlayerStatus.Idle, () => {
            console.log("Idleing mixer")
        });
        connection.player.on('error', (error) => {
            console.error(`Error on player `,error);
        });
    }

    pauseById(id: string) : boolean{
        this.mixer.pauseStream(id);
        return false;
    }

    playById(id: string) : boolean {
        this.mixer.playStream(id);
        return true;
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

            const stream = ytdl(url, { filter:'audioonly', quality: 'lowestaudio'});
            
            const ffmpeg = spawn('ffmpeg', [
                '-i', 'pipe:0',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                'pipe:1',
            ]);

            stream.pipe(ffmpeg.stdin)
            stream.on('error', (error) => {
                console.error(`Error in stream :`, error);
            });

            stream.on('close', () => {
                console.error(`close stream `);
            });
            this.mixer.addStream(ffmpeg.stdout, id);
            this.streams.set(id, {url: url, loop: loop});
        } else {
            throw new Error('Maximum number of streams reached');
        }
    } 
    removeStream(id: string) {
        this.mixer.removeStream(id);
    }


    destroy(){
    }
        
}

export default DynamicAudioMixer;


