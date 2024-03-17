import ytdl from 'ytdl-core';
const videoUrl = 'https://www.youtube.com/watch?v=lukT_WB5IB0'; // Replace with a valid YouTube video URL
const videoUrl2 = 'https://www.youtube.com/watch?v=opBFaCS_PV4';

//YJ63OTMDL4;https://www.youtube.com/watch?v=opBFaCS_PV4
//xYJ63OTMDL4



describe('ytdl Audio Frame Logging', () => {
    it('logs every audio frame from a ytdl download', async () => {

        const stream = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });

        await new Promise<void>((resolve, reject) => {
            stream.on('data', (chunk) => {
                // Log each chunk (audio frame)

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
const streams : Readable[] = [];
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
