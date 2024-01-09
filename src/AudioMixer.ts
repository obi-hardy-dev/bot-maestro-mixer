import { AudioPlayer, createAudioResource, StreamType, VoiceConnection } from '@discordjs/voice';
import ytdl from 'ytdl-core';
import fs, { WriteStream } from 'fs';
import { Duplex, Readable, Stream, Transform, TransformCallback } from 'stream';
import { Connection } from './ConnectionManager';
import RingBuffer from './utils/RingBuffer';
import { FFmpeg } from 'prism-media';


export class AudioMixingTransform extends Transform {
    private buffers: Map<string, {buffer: Buffer[], flushed: boolean}>;
    private key: string; 

    constructor(key: string,buffers: Map<string, { buffer: Buffer[], flushed: boolean}>) {
        super();
        this.key = key;
        this.buffers = buffers;
    }

    /*mixStreams(streams: Array<Readable>) {
        // Iterate over each sample
        for (let i = 0; i < this.buffer.length; i += this.channels) {
            let mixedSample = [0, 0]; // Assuming stereo

            // Mix samples from each stream
            streams.forEach(stream => {
                const sample = stream.read(); // Read current sample
                mixedSample[0] += sample.left;
                mixedSample[1] += sample.right;
            });

            // Average the samples and write to the buffer
            //this.buffer[i] = mixedSample[0] / streams.length;
            //this.buffer[i + 1] = mixedSample[1] / streams.length;
        }
    }
*/

    _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
        try{
            const buf = this.buffers.get(this.key)!.buffer
            buf.push(chunk);
            let readyToMix = Array.from(this.buffers.values()).every(buffer => buffer.buffer.length > 0);
            
            if(readyToMix){
                const pipes: Buffer[] =[];
                this.buffers.forEach((buffer, key) => {
                    pipes.push(buffer.buffer.shift()!);
                    if(buffer.buffer.length === 0 && buffer.flushed)
                        this.buffers.delete(key);

                });
                const mix = this.mixChunk(pipes);
                this.push(mix);
                 // Resume the stream if the buffer is below the threshold
                if (buf.length <= 1) {
                    this.resume();
                }

            }

            if(buf.length > 3)
                this.pause();

            callback();
        }
        catch(error){
            console.error(`Error in _transform of ${this.key}:`, error);
            if(error instanceof Error)
                callback(error); 
        };
        
    }
   
    _flush(callback: TransformCallback): void {
        console.log(`flush ${this.key}`);
        // Set the flag when no more chunks are coming
        this.buffers.get(this.key)!.flushed = true;
        callback();
    }

    mixChunk(pipes: Buffer[]) : Buffer {
        let maxSize = pipes.reduce((max, cur) => Math.max(max, cur.length), 0);
        const mixedChunk = Buffer.alloc(maxSize);
        for (let i = 0; i < maxSize; i += 2) { // Iterate by 2 bytes for 16-bit samples
            let sum = 0;
            let count = 0;

            pipes.forEach(pipe => {
                if (pipe.length > i + 1) { // Ensure we can read a full 16-bit sample
                    const sample = pipe.readInt16LE(i);
                    if (!isNaN(sample)) {
                        sum += sample;
                        count++;
                    }
                }
            });

            const mixedSample = count > 0 ? Math.round(sum / count) : 0;
            if (i < maxSize - 1) { // Ensure we don't write beyond the buffer
                mixedChunk.writeInt16LE(mixedSample, i);
            }
        }
        return mixedChunk;
    }    
}

class DynamicAudioMixer {
    private streams = new Map<string, {id: string, stream: Stream }>();
    private buffers = new Map<string, { buffer: Buffer[], flushed: boolean}>;
    private audioPlayer: AudioPlayer  | undefined;
    private readStream: Duplex; 
    private connection: Connection | undefined;
    private processingLoop: NodeJS.Timeout | undefined;

    constructor(connection: Connection) {
        this.connection = connection;
        this.audioPlayer = connection.player;
        this.readStream = new Duplex();
        this.audioPlayer.play(createAudioResource(this.readStream));
        this.audioPlayer.pause();
    }

    private SAMPLERATE = 48000; // 48 kHz
    private CHUNKDURATION_MS =10; // 1000 milliseconds

    private CHUNKSIZE = (this.SAMPLERATE / 1000) * this.CHUNKDURATION_MS; // Number of samples in each chunk

    addStream(url: string, id: string) {
        if (this.streams.size < 3) {
            const stream = ytdl(url, { filter: 'audioonly' }).pipe(new FFmpeg({
                args: [
                    '-f', 's16le', // 16-bit PCM
                    '-ar', '48000', // 48kHz sample rate
                    '-ac', '2', // Stereo (2 channels)
                ],
            }))
            .pipe(new AudioMixingTransform(id, this.buffers))
            .pipe(this.readStream);
            
            console.log("Add a new stream: " + id);
    
            stream.on('error', (error) => {
                console.error(`Error in stream ${id}:`, error);
                this.removeStream(id);
            });

            this.streams.set(id, {id: id, stream: stream});
            this.buffers.set(id, {buffer: [], flushed:false});
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


