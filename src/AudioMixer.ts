import { AudioPlayer, AudioResource, createAudioPlayer, createAudioResource, StreamType, VoiceConnection } from '@discordjs/voice';
import ytdl from 'ytdl-core';
import { Duplex, PassThrough, Readable, Stream, Transform, TransformCallback, Writable } from 'stream';
import { Connection } from './ConnectionManager';
import { FFmpeg, opus } from 'prism-media';
import { read } from 'fs';
import { wrap } from 'module';
import { buffer } from 'stream/consumers';
import { spawn } from 'child_process';

const MB = 1024 * 1024;
class SilentStream extends Readable{
    private silenceFrame: Buffer;
    private paused: boolean;
    constructor(){
        super();
        this.silenceFrame = Buffer.from(new Array(3840).fill(0)); // Adjust size based on your audio format
        this.paused = false;
    }
    _read(size: number) : void {
        if (!this.paused) {
            console.log("push silence")
            // Push silence frames continually
            while (this.push(this.silenceFrame)) {
                // Continue pushing until false is returned
            }
        }
    }

    pause(): this {
        this.paused = true;
        return super.pause();
    }

    resume(): this {
        this.paused = false;
        super.resume();
        this._read(1); // Resume pushing silence frames
        return this;
    }
}
class AudioBuffer {
    private buffer: Buffer;
    private maxSize: number;
    private isFull: boolean;
    private sourceStream: Readable;
    private readyToFlush: boolean;
    public done: boolean;
    private dataProcessedInSec: number;
    private lastProcessedTime: bigint | undefined; 
    private totalProcessedInSec: number;
    constructor(sourceStream:Readable, maxSize: number = MB * .5) {
        this.buffer = Buffer.alloc(0);
        this.maxSize = maxSize;
        this.isFull = false;
        this.dataProcessedInSec = 0;
        this.totalProcessedInSec = 0;
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
        if (this.buffer.length + data.length > this.maxSize * 0.5 || this.dataProcessedInSec > this.totalProcessedInSec + 2) {
            this.isFull = true;
            this.sourceStream.pause();
        }
    }
    processChunk(size: number, processFunction: Function) {
        // Process a chunk of data
        const chunk = this.buffer.subarray(0, size);
        this.buffer = this.buffer.subarray(size);
        processFunction(chunk); // Function that processes the chunk

        // Check if buffer has enough free space to resume streams
        if (this.isFull && this.buffer.length <= this.maxSize * 0.5) { // 50% threshold
            this.isFull = false;
            this.sourceStream.resume();
            console.log("paused");
            // Resume all paused streams
            // ...
        }
    }
    getChunk(size: number) : Buffer { 
        console.log(`${this.buffer.length} - ${this.maxSize} | ${this.dataProcessedInSec} - ${this.totalProcessedInSec}`);
        const now = process.hrtime.bigint(); 
        if(this.readyToFlush && size > this.buffer.length){
            const flush = this.buffer.subarray(0, size);
            this.buffer = Buffer.alloc(0);
            this.done = true;
            return flush;
        }

        if (this.buffer.length === 0.15){
            return Buffer.alloc(0);
        }


        const chunk = this.buffer.subarray(0, size);
        this.buffer = this.buffer.subarray(size);
        if (this.isFull && (this.buffer.length <= this.maxSize * 0.5 && this.dataProcessedInSec < this.totalProcessedInSec + .1 )) { // 50% threshold
            this.isFull = false;
            this.sourceStream.resume();
            console.log("resume");
            // Resume all paused streams
            // ...
        }

        this.dataProcessedInSec +=  (chunk.length / (2 * 2)) / 48000;
        if(this.lastProcessedTime){
            const timeElapsed = (now - this.lastProcessedTime); 
            this.totalProcessedInSec += Number(timeElapsed) / 1_000_000_000; 
        }

        this.lastProcessedTime = now;
        return chunk;
    }
}

type AudioObject = {
    buffer: AudioBuffer,
    paused: boolean, 
    flushed: boolean
}

export class AudioMixingTransform extends Transform {
    private buffers: Map<string, AudioObject>;
    private silentBuffer: AudioBuffer;
    private mixingInterval: number;
    public isActive = false;
    private lastPlaybackTime: bigint;
    private isDrained = true;

    constructor() {
        super();
        this.buffers = new Map<string, AudioObject>();
        this.mixingInterval  = 50; // milliseconds, adjust as needed
        this.lastPlaybackTime = process.hrtime.bigint();
        const silentStream = new SilentStream();
        this.silentBuffer = new AudioBuffer(silentStream);
        silentStream.on('data', (chunk: Buffer) => { 
            this.silentBuffer.append(chunk);
        });
        this.on('drain', () => {
            console.log("called");
            this.isDrained = true;
            this.mixAndOutput();
        });
        setInterval(() => {
            if (this.isDrained) {
                this.mixAndOutput();
            }
        }, this.mixingInterval);
    }
    getBufferSize() {
        const now = process.hrtime.bigint();
        const timeElapsed = (now - this.lastPlaybackTime) / BigInt(1000000); // Convert to milliseconds
        this.lastPlaybackTime = now;

        // Calculate buffer size based on time elapsed and sample rate
        const samplesToProcess = (48000 * (Number(timeElapsed) / 1000)) + 480;
        return samplesToProcess * 2 * 2;
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
        if(!this.isDrained) {
            return;
        }
        const bs = this.getBufferSize()
        console.log(bs);
        const pipes: Buffer[] =[];
        let anyPlaying = false;
        for(const [key, buffer] of this.buffers){
            if(!anyPlaying) anyPlaying = !buffer.paused;  
            const buf = buffer.buffer.getChunk(bs)!;
            if(!buf) return;
            if(buf.length> 0)
                pipes.push(buf);
            if(buffer.buffer.done)
                this.buffers.delete(key);

        }

        if(pipes.length > 0  ){
            if(pipes.length > 1) this.alignBuffers(...pipes);
            const mix = this.mixChunk(pipes);
             this.push(mix);
            console.log(`Pipin ${pipes.length} d= ${this.isDrained}`)
        }
        else if (!anyPlaying){
            this.push(this.silentBuffer.getChunk(bs));
            console.log("silence " + this.isDrained);
        }
    }
    
    addStream(stream: Readable, identifier: string) {
        // Create a buffer for the new stream and add it to the map
        this.buffers.set(identifier, {buffer: new AudioBuffer(stream), paused: false, flushed: false});

        // Handle data from the stream
        stream.on('data', chunk => {
            if (this.buffers.has(identifier)) {
                this.buffers.get(identifier)?.buffer.append(chunk);
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
}


console.log("tone");

class DynamicAudioMixer {

    private streams = new Map<string, {id: string, stream: Stream }>();
    private buffers = new Map<string, { buffer: Buffer[], flushed: boolean}>;
    private mixer: AudioMixingTransform; 
    private audioPlayer: AudioPlayer  | undefined;
    private connection: Connection | undefined;
    private processingLoop: NodeJS.Timeout | undefined;
    private interval: NodeJS.Timeout | undefined;
    constructor(connection: Connection) {
        this.connection = connection;
        this.audioPlayer = connection.player;
        this.mixer = new AudioMixingTransform();
        this.mixer.on('error', (error) => {
            console.error(`Error in mixer :`, error);
        });
        const player = createAudioPlayer();
        const resource = createAudioResource(this.mixer, { inputType: StreamType.Raw });
        player.play(resource);
        connection.voiceConnection.subscribe(player);
    }

    private SAMPLERATE = 48000; // 48 kHz
    private CHUNKDURATION_MS =10; // 1000 milliseconds

    private CHUNKSIZE = (this.SAMPLERATE / 1000) * this.CHUNKDURATION_MS; // Number of samples in each chunk

    addStream(url: string, id: string) {
        if (this.mixer.canAddStreams()) { 

            /*const streamInfo = await ytdl.getInfo(url);
            const audioFormat = ytdl.chooseFormat(streamInfo.formats, { quality: 'highestaudio' });
            const sampleRate = parseInt(audioFormat.audioSampleRate!, 10);
            // Log the format info (optional, for debugging)
            console.log('Audio format:', audioFormat);

            // Create the YTDL stream with the chosen format
            const stream = ytdl.downloadFromInfo(streamInfo, { filter:'audioonly', format: audioFormat, dlChunkSize: 16000, highWaterMark: 64000 });
        */
            const stream = ytdl(url, { filter:'audioonly', quality: 'highestaudio', dlChunkSize: 8000, highWaterMark: 16000 });
            // Decode the YTDL stream (Opus to PCM)
            const ffmpeg = spawn('ffmpeg', [
                '-i', 'pipe:0',      // Input from standard input
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                'pipe:1',            // Output to standard output
            ]);

            stream.pipe(ffmpeg.stdin)

            this.mixer.addStream(ffmpeg.stdout, id)

        } else {
            throw new Error('Maximum number of streams reached');
        }
    } 
    removeStream(id: string) {
        if (this.streams.has(id)) {
            this.streams.delete(id);
            this.buffers.delete(id);      
        }
    }


    destroy(){
        clearInterval(this.processingLoop);
    }
        
}

export default DynamicAudioMixer;


