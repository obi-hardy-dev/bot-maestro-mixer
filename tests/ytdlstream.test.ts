import ytdl from 'ytdl-core';
import fs from 'fs';
import { AudioMixingTransform } from '../src/AudioMixer';
import { Duplex, PassThrough, Readable, Stream, Transform, TransformCallback, } from 'stream';
import { FFmpeg, opus } from 'prism-media';
import winston from 'winston'; 
import { spawn } from 'child_process';
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'ffmpeg.log' })
    ],
});
const videoUrl = 'https://www.youtube.com/watch?v=lukT_WB5IB0'; // Replace with a valid YouTube video URL
const videoUrl2 = 'https://www.youtube.com/watch?v=opBFaCS_PV4';

//YJ63OTMDL4;https://www.youtube.com/watch?v=opBFaCS_PV4
//xYJ63OTMDL4

describe('ytdl Audio Stream Test', () => {
    it('saves the audio stream from a ytdl download', async () => {
        
        const streamInfo = await ytdl.getInfo(videoUrl);
        const audioFormat = ytdl.chooseFormat(streamInfo.formats, { quality: 'highestaudio' });
        const sampleRate = parseInt(audioFormat.audioSampleRate!, 10);
        // Log the format info (optional, for debugging)
        console.log('Audio format:', audioFormat);

        // Create the YTDL stream with the chosen format
        const stream = ytdl.downloadFromInfo(streamInfo, { filter:'audioonly', format: audioFormat });

        // Fetch the audio stream from YouTube

        // Decode the YTDL stream (Opus to PCM)
        const opusDecoder = new opus.Decoder({ 
            rate: sampleRate ?? 48000, 
            channels: audioFormat.audioChannels ?? 0, 
            frameSize: 960 });

        const demuxer = new opus.WebmDemuxer();

        // Re-encode the mixed audio (PCM to Opus)
        const opusEncoder = new opus.Encoder({
            rate: sampleRate ?? 48000, 
            channels: audioFormat.audioChannels ?? 0, 
            frameSize: 960 });
        // Spawn FFmpeg as a child process
        const ffmpeg = spawn('ffmpeg', [
            '-i', 'pipe:0',      // Input from standard input
            '-f', 'mp3',         // Output format: MP3
            '-ar', '48000',      // Sample rate
            '-ac', '2',          // Audio channels
            'pipe:1',            // Output to standard output
        ]);

        stream.pipe(demuxer).pipe(opusDecoder).pipe(ffmpeg.stdin);
        

        const outputStream = fs.createWriteStream('output.mp3');
        // Write FFmpeg's standard output to file

        // Capture FFmpeg's stderr output for logging
        ffmpeg.stderr.on('data', data => {
            console.error(`FFmpeg stderr: ${data}`);
        });

        // Error handling
        stream.on('error', error => console.error('YTDL Stream error:', error));
        ffmpeg.on('error', error => console.error('FFmpeg error:', error));
        ffmpeg.on('close', () => logger.info('FFmpeg process closed'));

        opusDecoder.on('end', () => {
            logger.info('Decoder end event');
        });

        opusDecoder.on('error', (error) => {
            console.error('Decoder error event', error);
        });


        opusEncoder.on('finish', () => {
            logger.info('Encoder finish event');
        });

        opusEncoder.on('error', (error) => {
            console.error('Encoder error event', error);
        });
        ffmpeg.stdout.pipe(outputStream);
        await new Promise<void>((resolve, reject) => {
            outputStream.on('finish', () => {
                logger.info("output done");
                resolve();
            });

            outputStream.on('error', (error) => {
                console.error('Stream Error:', error);
                reject(error);
            });
        });
    }, 20000 );
});

/*

describe('ytdl Audio Frame Logging', () => {
    it('logs every audio frame from a ytdl download', async () => {

        const stream = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });

        await new Promise<void>((resolve, reject) => {
            stream.on('data', (chunk) => {
                // Log each chunk (audio frame)

                console.log(chunk);
            });

            stream.on('end', () => {
                console.log('Stream ended.');
                resolve();
            });

            stream.on('error', (error) => {
                console.error('Stream Error:', error);
                reject(error);
            });
        });
    });
});

/*
describe('ytdl Stream with Ring Buffer', () => {
    it('processes ytdl stream using a ring buffer', async () => {
        const bufferSize = 1024; // Adjust based on your requirements
        const audioBuffer = new RingBuffer<Buffer>(bufferSize);

        const stream = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });

        await new Promise<void>((resolve, reject) => {
            stream.on('data', (chunk) => {
                // Enqueue the chunk into the ring buffer
                if (!audioBuffer.isFull()) {
                    audioBuffer.enqueue(chunk);
                } else {
                    // Handle buffer being full (e.g., process data, wait, log, etc.)
                }
            });

            stream.on('end', () => {
                console.log('Stream ended.');
                // Process any remaining data in the buffer
                while (!audioBuffer.isEmpty()) {
                    const data = audioBuffer.dequeue();
                    // Process the data
                }
                resolve();
            });

            stream.on('error', (error) => {
                console.error('Stream Error:', error);
                reject(error);
            });
        });
    });
});
*/
/*
 * const streams : Readable[] = [];
describe('YouTube Audio Stream Mixing with Delayed Start', () => {
    it('mixes audio streams from two YouTube videos with the second starting randomly during the first', async () => {
        const bufferSize = 1024; // Adjust based on your requirements

        const buffer1 = new RingBuffer<Buffer>(bufferSize);
        const buffer2 = new RingBuffer<Buffer>(bufferSize);

        let buffer2Initialized = false;
        const outputStream = fs.createWriteStream('mixed_audio_output.mp3');
        const streamPromises = [];

        const handleStream = (stream: Readable, buffer: RingBuffer<Buffer>) => {
            return new Promise((resolve, reject) => {
                stream.on('data', (chunk) => buffer.enqueue(chunk));
                stream.on('end', resolve);
                stream.on('error', reject);
            });
        };
        const buffers = [buffer1];
        const stream1 = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });
        streams.push(stream1);
        let stream2:Readable;


        // Random delay for the second stream
        const randomDelay = Math.random() + 10; 
        streamPromises.push(handleStream(stream1, buffer1));
        setTimeout(() => {
            stream2 = ytdl(videoUrl2, { quality: 'highestaudio', filter: 'audioonly' });
            streams.push(stream2);
            buffers.push(buffer2);
            streamPromises.push(handleStream(stream2, buffer2));
        }, randomDelay);
        const interval = setInterval(() => {
            if (!buffer1.isEmpty() || !buffer2.isEmpty()) {
                const pipes = [];
               
                if(buffers.length > 1) console.log("build pipes: " + buffers.length);
                for(let i = 0; i < buffers.length; i++){
                    try{
                        const pipe = buffers[i].dequeue();    
                        if(buffers.length > 1) console.log(i, pipe);
                        pipes.push(pipe);
                        if(buffers[i].isEmpty()){
                            buffers.splice(i,1);
                        }
                    }catch(error){
                        console.log(i);
                        console.log(error);   
                    }
                }
                
                const mixedChunk = mix(pipes); // Mix the chunks
                

                outputStream.write(mixedChunk);
            }
        }, 10);  
        // Await all stream processing to complete
        try {
            await Promise.all(streamPromises);
        } finally {
            streams.forEach((s) => {
                s.destroy();
            });
        }

        clearInterval(interval);
        outputstream.end();

        // Wait for outputStream to finish
        await new Promise(resolve => outputStream.on('finish', resolve));
    }, 30000);
});


function mix(pipes: Buffer[]) : Buffer{
    let maxSize = 0;
    console.log(pipes[0]?.length);
    pipes.forEach(pipe => {
       maxSize =Math.max(maxSize, pipe.length); 
    });
    const mixedChunk =  Buffer.alloc(maxSize);

    for(let i = 0; i < maxSize; i += 2) { // 2 bytes for each 16-bit sample
        let sum = 0;
        let count = 0;

        pipes.forEach(pipe => {
            try{
                const sample = pipe.readInt16LE(i);
                if (!isNaN(sample)) {
                    sum += sample;
                    count++;
                }
            }catch(error){

            }
        });

        const mixedSample = count > 0 ? Math.round(sum / count) : 0;
        try{
            mixedChunk.writeInt16LE(mixedSample, i);
        }catch(error){}
    }

    return mixedChunk;
}
*/
describe('Real-time Audio Stream Playback', () => {
    it('writes mixed audio streams to disk mimicking real-time playback', async () => {
        const audioProcessor = new AudioProcessor()
        const promises = [audioProcessor.processStream(videoUrl, "song")];
        const randomDelay = Math.random() * 1000; 
        setTimeout(() => {
            promises.push(audioProcessor.processStream(videoUrl2, "oof"))
        }, randomDelay);
        await Promise.all(promises);
    }, 200000);
});

class AudioProcessor {
    activeStreams: number;
    outputStream: Duplex;
    buffers: Map<string, {buffer: Buffer[], flushed: boolean}>;
    constructor() {
        this.activeStreams = 0;
        this.outputStream = new PassThrough();
        encodeToWAV(this.outputStream,"output");
        this.buffers = new Map<string, {buffer: Buffer[], flushed: boolean}>;
        this.outputStream.on('finish', () => {
            if (this.activeStreams === 0) {
                this.allStreamsFinished();
            }
        });
    }

    async processStream(streamUrl: string, id: string) : Promise<void> {
        const streamInfo =  await ytdl.getInfo(videoUrl);
        return new Promise((resolve, reject) => {
            this.activeStreams++;

            this.buffers.set(id, {buffer: [], flushed:false});
            const audioFormat = ytdl.chooseFormat(streamInfo.formats, { quality: 'highestaudio' });
            const sampleRate = parseInt(audioFormat.audioSampleRate!, 10);
            // Log the format info (optional, for debugging)
            console.log('Audio format:', audioFormat);

            // Create the YTDL stream with the chosen format
            const stream = ytdl.downloadFromInfo(streamInfo, { filter:'audioonly', format: audioFormat, dlChunkSize: 16000, highWaterMark: 64000 });


            // Decode the YTDL stream (Opus to PCM)
            const opusDecoder = new opus.Decoder({ 
                rate: sampleRate ?? 48000, 
                channels: audioFormat.audioChannels ?? 2, 
                frameSize: 960 });
            const lastpipe = stream
                .pipe(new opus.WebmDemuxer())
                .pipe(opusDecoder)
                .pipe(new AudioMixingTransform(id, this.buffers));
            lastpipe.on('data', (chunk) => {
                this.outputStream.write(chunk);
            });
            this.outputStream.on('end', () => {
                this.activeStreams--;
                if (this.activeStreams === 0) {
                    console.log("no active streams");
                }
                resolve();
            });

            stream.on('error', (error) => {
                console.error(error)
                this.activeStreams--;
                reject(error);
            });
        });
    }

    allStreamsFinished() {
        console.log("all done");
    }
}

function getStream(url: string) : Stream {
    const transcoder = new FFmpeg({
        args: [
            '-f', 's16le',       // Output format: PCM s16le
            '-ar', '48000',      // Sample rate: 48000 Hz
            '-ac', '2',          // Channels: 2 (stereo)
        ],
    });
    transcoder.on('close', () => logger.info('FFmpeg process closed'));
    transcoder.on('error', error => logger.error(`FFmpeg error: ${error.message}`));
    return ytdl(url, { quality: 'highestaudio', filter: 'audioonly', dlChunkSize: 16000, highWaterMark: 16000 });

}

function encodeToWAV(inputStream: Readable, fileName: string) {
    const fullFileName = fileName + '.wav'; 
        const ffmpeg = spawn('ffmpeg', [
            '-i', 'pipe:0',      // Input from standard input
            '-f', 'mp3',         // Output format: MP3
            '-ar', '48000',      // Sample rate
            '-ac', '2',          // Audio channels
            '-ab', '192k',       // MP3 bitrate
            'pipe:1',            // Output to standard output
        ]);

    // Pipe the input stream to FFmpeg

    inputStream.pipe(ffmpeg.stdin);

    // Write FFmpeg's standard output to file
    ffmpeg.stdout.pipe(fs.createWriteStream('outputmix.mp3'));
    ffmpeg.stderr.on('data', data => {
        console.error(`FFmpeg stderr: ${data}`);
    });

    // Error handling
    inputStream.on('error', error => console.error('Mixed Stream error:', error));
    ffmpeg.on('error', error => console.error('FFmpeg error:', error));
    ffmpeg.on('close', () => console.log('FFmpeg process closed'));

    // Additional logging for YTDL data
    inputStream.on('data', () => console.log('Mixed Data received'));
}


class DelayedStream extends Transform {
    delayMs: number;
    constructor(delayMs: number) {
        super();
        this.delayMs = delayMs; // Delay in milliseconds
    }

    _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
        setTimeout(() => {
            this.push(chunk);
            callback();
        }, this.delayMs);
    }
}

// Usage
